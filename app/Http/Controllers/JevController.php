<?php

namespace App\Http\Controllers;

use App\Actions\IssueJev;
use App\Http\Requests\StoreJevRequest;
use App\Models\Disposal;
use App\Models\DisposalJev;
use App\Models\Donation;
use App\Models\Asset;
use App\Models\Jev;
use App\Enums\AssetStatus;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\JsonResponse;

class JevController extends Controller
{
    /** Allowed sort keys => SQL expression (whitelisted, never user input). */
    private const SORTABLE = [
        'reference'  => 'COALESCE(aap_number, stcp_number)',
        'asset_type' => 'asset_type',
        'jev_number' => 'jev_number',
        'jev_type'   => 'jev_type',
        'recipient'  => 'recipient',
        'jev_date'   => 'jev_date',
        'amount'     => 'amount',
        'created_at' => 'created_at',
    ];

    private const DETAIL_ASSET_FIELDS = [
        'id', 'asset_code', 'aap_number', 'stcp_number', 'type',
        'quantity', 'quantity_unit', 'municipality_of_origin', 'location_apprehended',
    ];

    private const DETAIL_INCIDENT_FIELDS = [
        'incident_code', 'date_of_apprehension', 'apprehending_party', 'place_of_apprehension',
    ];

    private const DETAIL_PIECE_FIELDS = [
        'id', 'piece_number', 'species', 'description',
        'length', 'width', 'height',
        'volume_bd_ft', 'volume_cu_m', 'estimated_value',
        'vehicle_type', 'plate_number', 'equipment_type', 'serial_number',
        'disposed_at',
    ];

    public function index(Request $request): Response
    {
        $this->authorize('viewAny', Jev::class);

        $filters = $request->validate([
            'search'    => ['nullable', 'string', 'max:100'],
            'type'      => ['nullable', 'in:IN,OUT'],
            'status'    => ['nullable', 'in:issued,pending'],
            'date_from' => ['nullable', 'date'],
            'date_to'   => ['nullable', 'date', 'after_or_equal:date_from'],
            'sort'      => ['nullable', 'in:' . implode(',', array_keys(self::SORTABLE))],
            'direction' => ['nullable', 'in:asc,desc'],
        ]);

        $sort      = $filters['sort'] ?? 'created_at';
        $direction = $filters['direction'] ?? 'desc';

        // ── JEV IN rows ──
        $jevIn = Jev::select([
            'jevs.id',
            'jevs.asset_code',
            'jevs.asset_type',
            'jevs.jev_number',
            'jevs.jev_date',
            'jevs.amount',
            'jevs.created_at',
            'assets.aap_number',
            'assets.stcp_number',
            'assets.id as asset_id',
        ])
        ->selectRaw('NULL as recipient')
        ->selectRaw('NULL as disposal_id')
        ->selectRaw("'IN' as jev_type")
        ->leftJoin('assets', function ($join) {
            $join->on('assets.asset_code', '=', 'jevs.asset_code')
                ->whereColumn('assets.type', 'jevs.asset_type');
        });

        // ── JEV OUT rows (same column order as above) ──
        $jevOut = DisposalJev::select([
            'disposal_jevs.id',
            'assets.asset_code',
            'assets.type as asset_type',
            'disposal_jevs.jev_number',
            'disposal_jevs.uploaded_at as jev_date',
            DB::raw('NULL as amount'),
            'disposal_jevs.created_at',
            'assets.aap_number',
            'assets.stcp_number',
            'assets.id as asset_id',
            DB::raw('COALESCE(donations.agency_name, donations.requester_name) as recipient'),
            'disposals.id as disposal_id',
        ])
        ->selectRaw("'OUT' as jev_type")
        ->join('disposals', 'disposals.id', '=', 'disposal_jevs.disposal_id')
        ->join('assets', 'assets.id', '=', 'disposals.asset_id')
        ->leftJoin('donations', 'donations.id', '=', 'disposals.donation_id');

        // Union, then filter / sort / paginate on the combined set.
        $records = DB::query()->fromSub($jevIn->unionAll($jevOut->getQuery()), 'jev_records');

        if (($search = trim($filters['search'] ?? '')) !== '') {
            $like = '%' . addcslashes($search, '%_\\') . '%';
            $records->where(function ($q) use ($like) {
                foreach (['asset_code', 'aap_number', 'stcp_number', 'jev_number', 'recipient'] as $col) {
                    $q->orWhere($col, 'like', $like);
                }
            });
        }

        if (!empty($filters['type'])) {
            $records->where('jev_type', $filters['type']);
        }

        if (($filters['status'] ?? null) === 'issued') {
            $records->whereNotNull('jev_number');
        } elseif (($filters['status'] ?? null) === 'pending') {
            $records->whereNull('jev_number');
        }

        if (!empty($filters['date_from'])) {
            $records->whereDate('jev_date', '>=', $filters['date_from']);
        }
        if (!empty($filters['date_to'])) {
            $records->whereDate('jev_date', '<=', $filters['date_to']);
        }

        $jevs = $records
            ->orderByRaw(self::SORTABLE[$sort] . ' ' . $direction)
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString();

        // ── Pending JEV IN ──
        $pendingAssets = Asset::where('current_status', AssetStatus::ClearedForAccounting)
            ->whereNotExists(function ($query) {
                $query->selectRaw(1)
                    ->from('jevs')
                    ->whereColumn('jevs.asset_code', 'assets.asset_code')
                    ->whereColumn('jevs.asset_type', 'assets.type');
            })
            ->latest()
            ->get(['id', 'asset_code', 'aap_number', 'stcp_number', 'type', 'current_status'])
            ->unique(fn ($a) => $a->asset_code . '-' . ($a->type instanceof \App\Enums\AssetType ? $a->type->value : $a->type))
            ->values();

        // ── Pending JEV OUT, grouped by donation batch ──
        $disposalsAwaitingJevOut = Donation::query()
            ->whereHas('disposals', fn ($q) => $q->whereDoesntHave('disposalJev'))
            ->with(['disposals' => fn ($q) => $q->with(['asset', 'disposalJev'])])
            ->latest()
            ->get()
            ->filter(fn ($donation) =>
                $donation->disposals->every(fn ($d) => $d->disposalJev === null)
            )
            ->map(fn ($donation) => [
                'id'          => $donation->id,
                'batch_code'  => sprintf('DON-%04d', $donation->id),
                'recipient'   => $donation->agency_name ?: $donation->requester_name,
                'asset_count' => $donation->disposals->pluck('asset_id')->filter()->unique()->count(),
                'asset_codes' => $donation->disposals
                    ->map(fn ($d) => $d->asset?->asset_code)
                    ->filter()->unique()->take(3)->values(),
                'released_at' => $donation->released_at,
                'disposal_id' => $donation->disposals->first()?->id,
            ])
            ->values();

        // ── Summary cards ──
        $monthStart = now()->startOfMonth();
        $monthEnd   = now()->endOfMonth();

        $issuedThisMonth =
            Jev::whereNotNull('jev_number')
                ->whereRaw('COALESCE(jev_date, created_at) BETWEEN ? AND ?', [$monthStart, $monthEnd])
                ->count()
            + DisposalJev::whereNotNull('jev_number')
                ->whereRaw('COALESCE(uploaded_at, created_at) BETWEEN ? AND ?', [$monthStart, $monthEnd])
                ->count();

        return Inertia::render('Jev/Index', [
            'jevs'                    => $jevs,
            'pendingAssets'           => $pendingAssets,
            'disposalsAwaitingJevOut' => $disposalsAwaitingJevOut,
            'stats'                   => [
                'pending_in'        => $pendingAssets->count(),
                'pending_out'       => $disposalsAwaitingJevOut->count(),
                'issued_this_month' => $issuedThisMonth,
            ],
            'filters'                 => [
                'search'    => $filters['search'] ?? '',
                'type'      => $filters['type'] ?? '',
                'status'    => $filters['status'] ?? '',
                'date_from' => $filters['date_from'] ?? '',
                'date_to'   => $filters['date_to'] ?? '',
                'sort'      => $sort,
                'direction' => $direction,
            ],
            'can'                     => [
                'issue_jev' => $request->user()->can('create', Jev::class),
                'issue_jev_out' => $request->user()->can('jev.create'),
            ],
        ]);
    }

    public function showDisposalJev(Disposal $disposal): Response
    {
        $this->authorize('viewAny', Jev::class);

        $disposal->load(['disposalJev', 'donation']);

        $siblingsWithAssets = $disposal->donation
            ? \App\Models\Disposal::where('donation_id', $disposal->donation->id)
                ->with(['asset', 'asset.pieces' => fn($q) => $q->whereIn('disposal_id', 
                    \App\Models\Disposal::where('donation_id', $disposal->donation->id)->pluck('id')
                )])
                ->get()
            : collect();

        return Inertia::render('Jev/ShowDisposalJev', [
            'disposal'  => $disposal,
            'siblings'  => $siblingsWithAssets,
            'can' => [
                'issue_jev_out' => request()->user()->can('jev.create'),
            ],
        ]);
    }

    public function store(StoreJevRequest $request, Asset $asset, IssueJev $issueJev): RedirectResponse
    {
        $this->authorize('create', Jev::class);

        $issueJev->execute($asset, $request->validated(), $request->user());

        return back()->with('success', 'JEV issued successfully.');
    }

    public function show(Request $request, Asset $asset): Response
    {
        $this->authorize('view', $asset);

        $asset->load(['incident', 'pieces']);

        $jev = $asset->jev;

        return Inertia::render('Jev/Show', [
            'asset' => $asset,
            'jev'   => $jev,
            'can'   => [
                'issue_jev' => $request->user()->can('create', Jev::class),
            ],
        ]);
    }

    public function details(Request $request, Asset $asset): JsonResponse
    {
        $this->authorize('view', $asset);

        $asset->load(['incident', 'pieces']);
        $jev = $asset->jev;

        return response()->json([
            'asset' => array_merge($asset->only(self::DETAIL_ASSET_FIELDS), [
                'incident' => $asset->incident?->only(self::DETAIL_INCIDENT_FIELDS),
                'pieces'   => $asset->pieces
                    ->map(fn ($piece) => $piece->only(self::DETAIL_PIECE_FIELDS))
                    ->values(),
            ]),
            'jev' => $jev?->only(['jev_number', 'jev_date', 'particulars', 'amount', 'created_at']),
            'can' => [
                'issue_jev' => $request->user()->can('create', Jev::class),
            ],
        ]);
    }

    /** JSON for the JEV OUT modal. Same authorization and batch lookup as showDisposalJev(). */
    public function disposalDetails(Request $request, Disposal $disposal): JsonResponse
    {
        $this->authorize('viewAny', Jev::class);

        $disposal->load(['disposalJev', 'donation']);
        $donation = $disposal->donation;

        $siblings = $donation
            ? Disposal::where('donation_id', $donation->id)
                ->with(['asset', 'asset.pieces' => fn ($q) => $q->whereIn(
                    'disposal_id',
                    Disposal::where('donation_id', $donation->id)->pluck('id')
                )])
                ->get()
            : collect();

        return response()->json([
            'disposal' => [
                'id'           => $disposal->id,
                'donation'     => $donation?->only([
                    'id', 'requester_name', 'agency_name', 'municipality', 'barangay', 'street',
                ]),
                'disposal_jev' => $disposal->disposalJev?->only(['id', 'jev_number', 'created_at']),
            ],
            'siblings' => $siblings->map(fn ($s) => [
                'id'           => $s->id,
                'quantity'     => $s->quantity,
                'processed_at' => $s->processed_at,
                'asset'        => $s->asset ? [
                    'id'         => $s->asset->id,
                    'asset_code' => $s->asset->asset_code,
                    'type'       => $s->asset->type,
                    'aap_number' => $s->asset->aap_number,
                    'pieces'     => $s->asset->pieces
                        ->map(fn ($p) => $p->only([
                            'id', 'piece_number', 'species', 'volume_bd_ft', 'volume_cu_m', 'estimated_value',
                        ]))
                        ->values(),
                ] : null,
            ])->values(),
            'can' => [
                'issue_jev_out' => $request->user()->can('jev.create'),
            ],
        ]);
    }
}