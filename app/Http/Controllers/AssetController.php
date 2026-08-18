<?php

namespace App\Http\Controllers;

use App\Actions\CreateAsset;
use App\Actions\MarkAssetStored;
use App\Actions\SignAcknowledgementReceipt;
use App\Actions\UpdateCaseDetails;
use App\Http\Requests\UpdateCaseDetailsRequest;
use App\Http\Requests\UpdateAapNumberRequest;
use App\Http\Requests\UpdateAssetRequest;
use Illuminate\Support\Facades\Storage;
use App\Services\PdfDocumentService;
use App\Enums\AssetMode;
use App\Enums\AssetStatus;
use App\Enums\AssetType;
use App\Http\Requests\StoreAssetRequest;
use App\Models\Asset;
use App\Services\QrCodeService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AssetController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', Asset::class);

        $allAssets = Asset::query()
            ->when($request->status, fn ($q, $status) => $q->where('current_status', $status))
            ->when($request->type, fn ($q, $type) => $q->where('type', $type))
            ->when($request->search, function ($q, $search) {
                $q->where(function ($query) use ($search) {
                    $query->where('asset_code', 'like', "%{$search}%")
                        ->orWhere('species', 'like', "%{$search}%")
                        ->orWhere('municipality_of_origin', 'like', "%{$search}%");
                });
            })
            ->latest()
            ->get(['id', 'asset_code', 'type', 'municipality_of_origin', 'current_status', 'created_at']);

        $grouped = $allAssets->groupBy('asset_code')->map(function ($group) {
            $first = $group->first();

            return [
                'asset_code' => $first->asset_code,
                'item_count' => $group->count(),
                'types' => $group->pluck('type')->map(fn ($t) => $t->value)->unique()->values(),
                'municipality_of_origin' => $first->municipality_of_origin,
                'status_summary' => $group->groupBy(fn ($a) => $a->current_status->value)
                    ->map(fn ($g, $status) => ['status' => $status, 'count' => $g->count()])
                    ->values(),
                'created_at' => $first->created_at,
            ];
        })->sortByDesc('created_at')->values();

        $page = max(1, (int) $request->integer('page', 1));
        $perPage = 15;

        $paginated = new \Illuminate\Pagination\LengthAwarePaginator(
            $grouped->forPage($page, $perPage)->values(),
            $grouped->count(),
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()],
        );

        return Inertia::render('Assets/Index', [
            'assets' => $paginated,
            'filters' => $request->only(['status', 'type', 'search']),
            'statuses' => collect(AssetStatus::cases())->map(fn ($s) => ['value' => $s->value, 'label' => $s->label()]),
            'types' => collect(AssetType::cases())->map(fn ($t) => ['value' => $t->value, 'label' => $t->label()]),
        ]);
    }

    public function create(): Response
    {
        $this->authorize('create', Asset::class);

        return Inertia::render('Assets/Create', [
            'types' => collect(AssetType::cases())->map(fn ($t) => [
                'value' => $t->value,
                'label' => $t->label(),
            ]),
            'modes' => collect(AssetMode::cases())->map(fn ($m) => [
                'value' => $m->value,
                'label' => $m->label(),
            ]),
            'municipalities' => collect(\App\Enums\Municipality::cases())->map(fn ($m) => [
                'value' => $m->value,
                'label' => $m->value,
            ]),
            'barangaysByMunicipality' => config('barangays'),
        ]);
    }

    public function store(StoreAssetRequest $request, CreateAsset $createAsset): RedirectResponse
    {
        $asset = $createAsset->execute($request->validated(), $request->user());

        return redirect()->route('assets.show', $asset)
            ->with('success', 'Asset intake recorded successfully.');
    }

    public function show(Request $request, Asset $asset, QrCodeService $qrCodeService): Response
    {
        $this->authorize('view', $asset);

        \App\Models\Notification::where('user_id', $request->user()->id)
            ->where('asset_id', $asset->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        $asset->load([
            'incident',
            'pieces',
            'creator',
            'acknowledgementReceipt.signedByCustodian',
            'statusHistory.changedBy',
            'jev.createdByAccounting',
            'jev.uploadedByMes',
            'disposals.donation',
            'disposals.disposalJev.issuedByAccounting',
            'disposals.disposalJev.uploadedByMes',
            'disposals.icsRecord',
            'disposals.parRecord',
            'qrScans.scannedBy',
            'documents.uploadedBy',
            'documents.verifiedBy',
        ]);

        $relatedAssets = Asset::where('asset_code', $asset->asset_code)
            ->where('id', '!=', $asset->id)
            ->with(['acknowledgementReceipt', 'statusHistory'])
            ->get();

        $qrPayload = null;
        $qrSvg = null;

        if ($asset->acknowledgementReceipt?->signed_at) {
            $qrPayload = $qrCodeService->buildScanUrl($asset->qr_code_token);
            $qrSvg = $qrCodeService->generateSvg($qrPayload);
        }

        return Inertia::render('Assets/Show', [
            'asset' => $asset,
            'qrPayload' => $qrPayload,
            'qrSvg' => $qrSvg,
            'requiredDocumentTypes' => collect($asset->requiredDocumentTypes())->map(fn ($t) => [
                'value' => $t->value,
                'label' => $t->label(),
            ]),
            'modes' => collect(AssetMode::cases())->map(fn ($m) => [   // ← new: needed by edit modal
                'value' => $m->value,
                'label' => $m->label(),
            ]),
            'can' => [
                'markStored' => $request->user()?->can('markStored', $asset) ?? false,
                'generateQr' => $request->user()?->can('generateQr', $asset) ?? false,
                'updateAap' => $request->user()?->can('updateAap', $asset) ?? false,
                'createJev' => $request->user()?->can('create', \App\Models\Jev::class) ?? false,
                'uploadJev' => $asset->jev ? ($request->user()?->can('upload', $asset->jev) ?? false) : false,
                'resolveCase' => $request->user()?->can('updateCaseStatus', $asset) ?? false,
                'releaseDonation' => $request->user()?->can('disposals.process') ?? false,
                'processDisposal' => $request->user()?->can('create', \App\Models\Disposal::class) ?? false,
                'updateCaseDetails' => $asset->has_ongoing_case && ($request->user()?->can('assets.update_case') ?? false),
                'uploadEvidence' => $request->user()?->can('documents.upload') ?? false,
                'verifyDocuments' => $request->user()?->can('documents.verify') ?? false,
                'issueJevOut' => $request->user()?->can('jev.create') ?? false,
                'uploadJevOut' => $request->user()?->can('jev.upload') ?? false,
                'edit' => $request->user()?->can('assets.update') ?? false,   // ← new
            ],
        ]);
    }

    public function byCode(Request $request, string $assetCode)
    {
        $items = Asset::where('asset_code', $assetCode)
            ->with(['acknowledgementReceipt', 'creator', 'jev', 'disposals.donation'])
            ->get();

        abort_if($items->isEmpty(), 404);

        foreach ($items as $item) {
            $this->authorize('view', $item);
        }

        return response()->json(['items' => $items]);
    }

    public function updateAapNumber(UpdateAapNumberRequest $request, Asset $asset, \App\Services\AuditLogService $auditLog): RedirectResponse
    {
        $this->authorize('updateAap', $asset);

        $before = $asset->only('aap_number');

        $asset->update(['aap_number' => $request->validated('aap_number')]);

        $auditLog->log('asset.aap_number_updated', $asset, $before, $asset->fresh()->only('aap_number'), $request->user()->id);

        return back()->with('success', 'AAP No. updated.');
    }

    public function markStored(Asset $asset, MarkAssetStored $action): RedirectResponse
    {
        $this->authorize('markStored', $asset);

        $action->execute($asset, request()->user());

        return back()->with('success', 'Asset marked as stored.');
    }

    public function printStickers(Asset $asset, PdfDocumentService $pdfService)
    {
        $this->authorize('view', $asset);

        $path = $pdfService->generateAssetTagStickers($asset);
        $content = Storage::disk('local')->get($path);

        return response($content, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="stickers-'.$asset->asset_code.'.pdf"',
        ]);
    }

    public function resolveTrial(Asset $asset, \App\Actions\ResolveTrial $action): RedirectResponse
    {
        $this->authorize('updateCaseStatus', $asset);

        $action->execute($asset, request()->user());

        return back()->with('success', 'Case resolved. Asset cleared for accounting.');
    }

    public function updateCaseDetails(UpdateCaseDetailsRequest $request, Asset $asset, UpdateCaseDetails $action): RedirectResponse
    {
        $action->execute($asset, $request->validated(), $request->user());

        return back()->with('success', 'Case details updated.');
    }

    public function update(UpdateAssetRequest $request, Asset $asset, \App\Services\AuditLogService $auditLog): RedirectResponse
    {

        $fields = [
            'species', 'description', 'quantity', 'quantity_unit',
            'length', 'width', 'height', 'volume_bd_ft', 'volume_cu_m',
            'estimated_value', 'plate_number', 'location_apprehended',
            'apprehending_agency', 'mode', 'has_ongoing_case', 'has_confiscation_order',
        ];

        $before = $asset->only($fields);

        $asset->update($request->validated());

        $auditLog->log(
            'asset.updated',
            $asset,
            $before,
            $asset->fresh()->only($fields),
            $request->user()->id,
        );

        return back()->with('success', 'Asset updated successfully.');
    }
}