<?php

namespace App\Http\Controllers;

use App\Actions\IssueJev;
use App\Http\Requests\StoreJevRequest;
use App\Models\Disposal;
use App\Models\Asset;
use App\Models\Jev;
use App\Enums\AssetStatus;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class JevController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', Jev::class);

        $jevIn = Jev::select([
            'jevs.id',
            'jevs.asset_code',
            'jevs.asset_type',
            'jevs.jev_number',
            'jevs.jev_date',
            'jevs.amount',
            'jevs.created_at',
            'assets.aap_number',
            'assets.id as asset_id',
        ])
        ->selectRaw("'IN' as jev_type")
        ->leftJoin('assets', function ($join) {
            $join->on('assets.asset_code', '=', 'jevs.asset_code')
                ->whereColumn('assets.type', 'jevs.asset_type');
        })
        ->latest('jevs.created_at');

        $jevOut = \App\Models\DisposalJev::select([
            'disposal_jevs.id',
            'assets.asset_code',
            'assets.type as asset_type',
            'disposal_jevs.jev_number',
            'disposal_jevs.uploaded_at as jev_date',
            DB::raw('NULL as amount'),
            'disposal_jevs.created_at',
            'assets.aap_number',
            'assets.id as asset_id',
        ])
        ->selectRaw("'OUT' as jev_type")
        ->join('disposals', 'disposals.id', '=', 'disposal_jevs.disposal_id')
        ->join('assets', 'assets.id', '=', 'disposals.asset_id')
        ->latest('disposal_jevs.created_at');

        // Union both, paginate
        $jevs = $jevIn
            ->unionAll($jevOut->getQuery())
            ->latest('created_at')
            ->paginate(25);

        $pendingAssets = Asset::where('current_status', AssetStatus::ClearedForAccounting)
            ->whereNotExists(function ($query) {
                $query->selectRaw(1)
                    ->from('jevs')
                    ->whereColumn('jevs.asset_code', 'assets.asset_code')
                    ->whereColumn('jevs.asset_type', 'assets.type');
            })
            ->latest()
            ->get(['id', 'asset_code', 'aap_number', 'type', 'current_status'])
            ->unique(fn ($a) => $a->asset_code . '-' . ($a->type instanceof \App\Enums\AssetType ? $a->type->value : $a->type))
            ->values();

        $disposalsAwaitingJevOut = \App\Models\Donation::query()
            ->whereHas('disposals', fn ($q) => $q->whereDoesntHave('disposalJev'))
            ->with(['disposals' => fn ($q) => $q->with(['asset', 'disposalJev'])])
            ->latest()
            ->get()
            ->filter(fn ($donation) =>
                $donation->disposals->every(fn ($d) => $d->disposalJev === null)
            )
            ->values();

        return Inertia::render('Jev/Index', [
            'jevs'                    => $jevs,
            'pendingAssets'           => $pendingAssets,
            'disposalsAwaitingJevOut' => $disposalsAwaitingJevOut,
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
}