<?php

namespace App\Http\Controllers;

use App\Actions\ProcessDisposal;
use App\Actions\ReleaseDonation;
use App\Enums\DisposalType;
use App\Enums\Municipality;
use App\Http\Requests\ProcessDisposalRequest;
use App\Models\Asset;
use App\Models\Disposal;
use App\Services\AssetLifecycleService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\Request;
use App\Actions\ProcessBatchDonation;
use App\Http\Requests\StoreBatchDonationRequest;
use App\Actions\IssueDisposalJevOut;
use App\Http\Requests\StoreDisposalJevOutRequest;
use App\Actions\UploadDisposalJevOut;
use App\Http\Requests\UploadDisposalJevOutRequest;

class DisposalController extends Controller
{
    protected const MODES = ['log', 'vehicle', 'equipment'];

    public function index(Request $request): Response
    {
        $this->authorize('viewAny', Disposal::class);

        $mode = $request->query('mode');
        if (! in_array($mode, self::MODES, true)) {
            $mode = null;
        }

        $baseQuery = Asset::query()->where('current_status', 'for_disposal');

        // Counts per mode, shown on the mode-selection cards regardless of
        // which mode (if any) is currently selected.
        $modeCounts = [
            'log' => (clone $baseQuery)->where('type', 'log')->count(),
            'vehicle' => (clone $baseQuery)->where('type', 'vehicle')->count(),
            'equipment' => (clone $baseQuery)->where('type', 'equipment')->count(),
        ];

        $assets = (clone $baseQuery)
            ->when($mode, fn ($q) => $q->where('type', $mode))
            ->with(['jev', 'creator'])
            ->latest()
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Disposals/Index', [
            'assets' => $assets,
            'mode' => $mode,
            'modeCounts' => $modeCounts,
            'can' => [
                'process' => request()->user()->can('create', Disposal::class),
            ],
        ]);
    }

    public function create(Asset $asset, AssetLifecycleService $lifecycle): Response
    {
        $this->authorize('create', Disposal::class);
        $this->authorize('view', $asset);

        $availableAssets = collect();
        if ($asset->type === \App\Enums\AssetType::Log) {
            $availableAssets = Asset::query()
                ->where('type', 'log')
                ->where('id', '!=', $asset->id)
                ->where('current_status', 'for_disposal')
                ->whereColumn('disposed_quantity', '<', 'quantity')
                ->with('incident')
                ->latest()
                ->get()
                ->map(function (Asset $a) {
                    $data = $a->toArray();
                    $data['remaining_quantity'] = $a->remainingQuantity();

                    return $data;
                });
        }

        return Inertia::render('Disposals/Create', [
            'asset' => [
                ...$asset->load(['jev'])->toArray(),
                'remaining_quantity' => $asset->remainingQuantity(),
            ],
            'disposalTypes' => collect($lifecycle->allowedDisposalTypes($asset))->map(fn ($t) => [
                'value' => $t->value,
                'label' => $t->label(),
            ]),
            'municipalities' => collect(Municipality::cases())->map(fn ($m) => [
                'value' => $m->value,
                'label' => $m->value,
            ]),
            'barangaysByMunicipality' => config('barangays'),
            'availableAssets' => $availableAssets,
        ]);
    }

    public function store(ProcessDisposalRequest $request, Asset $asset, ProcessDisposal $processDisposal): RedirectResponse
    {
        $this->authorize('create', Disposal::class);

        $type = DisposalType::from($request->validated('disposal_type'));
        $details = array_filter([
            'requester_name' => $request->validated('requester_name'),
            'organization_type' => $request->validated('organization_type'),
            'organization_type_other' => $request->validated('organization_type_other'),
            'agency_name' => $request->validated('agency_name'),
            'municipality' => $request->validated('municipality'),
            'barangay' => $request->validated('barangay'),
            'street' => $request->validated('street'),
            'notes' => $request->validated('notes'),
            'appeal_filed' => $request->boolean('appeal_filed'),
            'appeal_deadline' => $asset->appeal_deadline?->toIso8601String(),
            'delivery_coordinates' => $request->validated('delivery_coordinates'),

            'donee_position' => $request->validated('donee_position'),
            'purpose_statement' => $request->validated('purpose_statement'),
            'confiscation_order_reference' => $request->validated('confiscation_order_reference'),
            'donor_representative_name' => $request->validated('donor_representative_name'),
            'donor_representative_title' => $request->validated('donor_representative_title'),
            'witness_1_name' => $request->validated('witness_1_name'),
            'witness_1_title' => $request->validated('witness_1_title'),
            'witness_2_name' => $request->validated('witness_2_name'),
            'witness_2_title' => $request->validated('witness_2_title'),
        ], fn ($value) => $value !== null && $value !== '');

        $processDisposal->execute(
            $asset,
            $type,
            $request->user(),
            $details,
            $request->validated('quantity'),
        );

        return redirect()->route('assets.show', $asset)
            ->with('success', 'Disposal processed successfully.');
    }

    public function releaseDonation(Request $request, Disposal $disposal, ReleaseDonation $releaseDonation): RedirectResponse
    {
        $this->authorize('create', Disposal::class);

        $request->validate(['photo' => ['nullable', 'file', 'image', 'max:8192']]);

        $releaseDonation->execute($disposal, $request->user(), $request->file('photo'));

        return back()->with('success', 'Donation marked as released.');
    }

    public function createBatchDonation(): Response
    {
        $this->authorize('create', Disposal::class);

        $assets = Asset::query()
            ->where('type', 'log')
            ->where('current_status', 'for_disposal')
            ->whereColumn('disposed_quantity', '<', 'quantity')
            ->with('incident')
            ->latest()
            ->get()
            ->map(function (Asset $asset) {
                $data = $asset->toArray();
                $data['remaining_quantity'] = $asset->remainingQuantity();

                return $data;
            });

        return Inertia::render('Disposals/CreateBatchDonation', [
            'assets' => $assets,
            'municipalities' => collect(Municipality::cases())->map(fn ($m) => [
                'value' => $m->value,
                'label' => $m->value,
            ]),
            'barangaysByMunicipality' => config('barangays'),
        ]);
    }

    public function storeBatchDonation(StoreBatchDonationRequest $request, ProcessBatchDonation $processBatchDonation): RedirectResponse
    {
        $this->authorize('create', Disposal::class);

        $donationDetails = array_filter([
            'requester_name' => $request->validated('requester_name'),
            'organization_type' => $request->validated('organization_type'),
            'organization_type_other' => $request->validated('organization_type_other'),
            'agency_name' => $request->validated('agency_name'),
            'municipality' => $request->validated('municipality'),
            'barangay' => $request->validated('barangay'),
            'street' => $request->validated('street'),
            'delivery_coordinates' => $request->validated('delivery_coordinates'),
            'notes' => $request->validated('notes'),

            'donee_position' => $request->validated('donee_position'),
            'purpose_statement' => $request->validated('purpose_statement'),
            'confiscation_order_reference' => $request->validated('confiscation_order_reference'),
            'donor_representative_name' => $request->validated('donor_representative_name'),
            'donor_representative_title' => $request->validated('donor_representative_title'),
            'witness_1_name' => $request->validated('witness_1_name'),
            'witness_1_title' => $request->validated('witness_1_title'),
            'witness_2_name' => $request->validated('witness_2_name'),
            'witness_2_title' => $request->validated('witness_2_title'),
        ], fn ($value) => $value !== null && $value !== '');

        $disposals = $processBatchDonation->execute(
            $request->validated('lines'),
            $donationDetails,
            $request->user(),
        );

        return redirect()->route('disposals.index')
            ->with('success', "Donation recorded across {$disposals->count()} asset(s).");
    }

    public function issueJevOut(StoreDisposalJevOutRequest $request, Disposal $disposal, IssueDisposalJevOut $issueDisposalJevOut): RedirectResponse
    {
        $issueDisposalJevOut->execute($disposal, $request->validated(), $request->user());

        return back()->with('success', 'JEV Out number recorded. Awaiting MES upload confirmation.');
    }

    public function uploadJevOut(UploadDisposalJevOutRequest $request, Disposal $disposal, UploadDisposalJevOut $uploadDisposalJevOut): RedirectResponse
    {
        $disposal->loadMissing('disposalJev');

        abort_if($disposal->disposalJev === null, 404, 'No JEV Out has been issued for this disposal yet.');

        $uploadDisposalJevOut->execute($disposal->disposalJev, $request->user());

        return back()->with('success', 'JEV Out uploaded. Release Order and Waybill generated.');
    }

    public function scanLookup(Request $request): \Illuminate\Http\JsonResponse
    {
        $this->authorize('create', Disposal::class);

        $request->validate([
            'payload' => ['required', 'string', 'max:2000'],
        ]);

        $token = $this->extractQrToken($request->input('payload'));

        if (! $token) {
            return response()->json(['message' => 'Could not read a valid QR code.'], 422);
        }

        $assetPiece = \App\Models\AssetPiece::where('qr_code_token', $token)->first();

        if ($assetPiece) {
            $asset = $assetPiece->asset;
            $pieceNumber = $assetPiece->piece_number;
        } else {
            $asset = Asset::where('qr_code_token', $token)->first();
            $pieceNumber = null;
        }

        if (! $asset) {
            return response()->json(['message' => 'No asset found for this QR code.'], 404);
        }

        if ($asset->type !== \App\Enums\AssetType::Log) {
            return response()->json(['message' => "{$asset->asset_code} is not a log asset and cannot be donated."], 422);
        }

        if ($asset->current_status !== \App\Enums\AssetStatus::ForDisposal) {
            return response()->json(['message' => "{$asset->asset_code} is not marked for disposal."], 422);
        }

        // This is the actual fix: reject the specific scanned piece if it was
        // already disposed, BEFORE falling back to the asset-level remaining
        // count. Previously this check didn't exist, so a piece that was
        // already donated still looked "available" as long as other pieces
        // of the same AAP were undisposed.
        if ($assetPiece && $assetPiece->isDisposed()) {
            return response()->json([
                'message' => "Piece {$pieceNumber} of {$asset->asset_code} has already been disposed.",
            ], 422);
        }

        if ($assetPiece) {
            $remaining = 1;
        } else {
            $remaining = $asset->remainingQuantity();
        }

        if ($remaining <= 0) {
            return response()->json(['message' => "{$asset->asset_code} has already been fully disposed."], 422);
        }

        return response()->json([
            'id' => $asset->id,
            'asset_code' => $asset->asset_code,
            'species' => $asset->species,
            'description' => $asset->description,
            'quantity' => $asset->quantity,
            'remaining_quantity' => $remaining,
            'piece_number' => $pieceNumber,
            'piece_id' => $assetPiece?->id,
        ]);
    }

    protected function extractQrToken(string $payload): ?string
    {
        $payload = trim($payload);

        if (preg_match('/^[a-f0-9]{64}$/i', $payload)) {
            return $payload;
        }

        $path = parse_url($payload, PHP_URL_PATH);

        if ($path && preg_match('#/scan/([a-f0-9]{64})#i', $path, $matches)) {
            return $matches[1];
        }

        return null;
    }
}