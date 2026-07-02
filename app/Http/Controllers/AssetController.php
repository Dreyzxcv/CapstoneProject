<?php

namespace App\Http\Controllers;

use App\Actions\CreateAsset;
use App\Actions\MarkAssetStored;
use App\Actions\SignAcknowledgementReceipt;
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

        $assets = Asset::query()
            ->with(['creator', 'acknowledgementReceipt'])
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
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Assets/Index', [
            'assets' => $assets,
            'filters' => $request->only(['status', 'type', 'search']),
            'statuses' => collect(AssetStatus::cases())->map(fn ($s) => [
                'value' => $s->value,
                'label' => $s->label(),
            ]),
            'types' => collect(AssetType::cases())->map(fn ($t) => [
                'value' => $t->value,
                'label' => $t->label(),
            ]),
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

        $asset->load([
            'creator',
            'acknowledgementReceipt.signedByCustodian',
            'statusHistory.changedBy',
            'jev.createdByAccounting',
            'jev.uploadedByMes',
            'disposal.donation',
            'disposal.icsRecord',
            'disposal.parRecord',
            'qrScans.scannedBy',
            'documents.uploadedBy',
        ]);

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
            'can' => [
                'signReceipt' => $request->user()?->can('signReceipt', $asset) ?? false,
                'markStored' => $request->user()?->can('markStored', $asset) ?? false,
                'generateQr' => $request->user()?->can('generateQr', $asset) ?? false,
                'uploadJev' => $asset->jev ? ($request->user()?->can('upload', $asset->jev) ?? false) : false,
                'releaseDonation' => $request->user()?->can('disposals.process') ?? false,
            ],
        ]);
    }

    public function signReceipt(Asset $asset, SignAcknowledgementReceipt $action): RedirectResponse
    {
        $this->authorize('signReceipt', $asset);

        $action->execute($asset, request()->user());

        return back()->with('success', 'Acknowledgement receipt signed.');
    }

    public function markStored(Asset $asset, MarkAssetStored $action): RedirectResponse
    {
        $this->authorize('markStored', $asset);

        $action->execute($asset, request()->user());

        return back()->with('success', 'Asset marked as stored.');
    }
}
