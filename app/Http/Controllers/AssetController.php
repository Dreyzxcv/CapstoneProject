<?php

namespace App\Http\Controllers;

use App\Actions\CreateAsset;
use App\Actions\MarkAssetStored;
use App\Actions\UpdateCaseDetails;
use App\Http\Requests\UpdateCaseDetailsRequest;
use App\Http\Requests\UpdateAapNumberRequest;
use App\Actions\SubmitAapForReview;
use App\Http\Requests\UpdateAssetRequest;
use App\Actions\SubmitForCustodyReview;
use App\Actions\ResolveCustodyReview;
use Illuminate\Support\Facades\Storage;
use App\Services\PdfDocumentService;
use App\Http\Requests\UpdateStcpNumberRequest;
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
                        ->orWhere('aap_number', 'like', "%{$search}%")
                        ->orWhere('species', 'like', "%{$search}%")
                        ->orWhere('municipality_of_origin', 'like', "%{$search}%");
                });
            })
            ->when($request->filled('incident_id'), fn ($q) => $q->where('incident_id', $request->integer('incident_id')))
            ->latest()
            ->get(['id', 'asset_code', 'aap_number', 'type', 'municipality_of_origin', 'current_status', 'created_at']);

        $grouped = $allAssets->groupBy('asset_code')->map(function ($group) {

            $first = $group->sortBy('id')->first();

            return [
                'asset_code'            => $first->asset_code,
                'first_asset_id'        => $first->id,
                'aap_number'            => $group->firstWhere(fn ($a) => $a->aap_number)?->aap_number,
                'item_count'            => $group->count(),
                'types'                 => $group->pluck('type')->map(fn ($t) => $t->value)->unique()->values(),
                'municipality_of_origin'=> $first->municipality_of_origin,
                'status_summary'        => $group->groupBy(fn ($a) => $a->current_status->value)
                                                ->map(fn ($g, $status) => ['status' => $status, 'count' => $g->count()])
                                                ->values(),
                'created_at'            => $first->created_at,
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
            'filters' => $request->only(['status', 'type', 'search', 'incident_id']),
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

    public function show(Request $request, Asset $asset, QrCodeService $qrCodeService): Response|RedirectResponse
    {
        $this->authorize('view', $asset);

        $primaryAsset = Asset::where('asset_code', $asset->asset_code)
            ->orderBy('id')
            ->first();

        if ($primaryAsset && $primaryAsset->id !== $asset->id) {
            return redirect()
                ->route('assets.show', $primaryAsset->id)
                ->with('info', "You were redirected to the primary record for {$asset->asset_code}.");
        }

        \App\Models\Notification::where('user_id', $request->user()->id)
            ->where('asset_id', $asset->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        $asset->load([
            'incident',
            'pieces',
            'creator',
            'acknowledgementReceipt.signedByCustodian',
            'jev.createdByAccounting',
            'disposals.donation',
            'disposals.disposalJev.issuedByAccounting',
            'disposals.disposalJev.uploadedByMes',
            'disposals.icsRecord',
            'disposals.parRecord',
            'qrScans.scannedBy',
            'documents.uploadedBy',
            'documents.verifiedBy',
            'statusHistory.changedBy.roles',
        ]);

        $relatedAssets = Asset::where('asset_code', $asset->asset_code)
            ->where('id', '!=', $asset->id)
            ->with(['acknowledgementReceipt', 'statusHistory.changedBy.roles', 'pieces'])
            ->get();

        $jevStatuses = ['for_disposal', 'donation_pending_jev_out', 'pending_release', 'donated', 'decayed', 'fabricated', 'released', 'forfeited', 'damaged'];
        
        $allStatusHistory = collect([$asset, ...$relatedAssets->all()])
            ->flatMap(fn ($a) => $a->statusHistory->map(function ($entry) use ($a) {
                $entry->asset_type = $a->type instanceof \App\Enums\AssetType
                    ? $a->type->value
                    : $a->type;
                return $entry;
            }))
            ->sortBy('changed_at')
            ->values()
            ->reduce(function ($carry, $entry) use ($jevStatuses) {
                $statusValue = $entry->getRawOriginal('status') ?? (
                    $entry->status instanceof \App\Enums\AssetStatus
                        ? $entry->status->value
                        : $entry->status
                );

                if (in_array($statusValue, $jevStatuses)) {
                    $carry->push($entry);
                    return $carry;
                }

                // Find existing entry with same status + notes
                $existingIndex = $carry->search(
                    fn ($e) => $e->status === $entry->status && $e->notes === $entry->notes
                );

                if ($existingIndex === false) {
                    $carry->push($entry);
                } elseif ($entry->changed_by && !$carry[$existingIndex]->changed_by) {
                    // Replace with the one that has a user attached
                    $carry[$existingIndex] = $entry;
                }

                return $carry;
            }, collect())
            ->sortBy('changed_at')
            ->values();
            
        $qrPayload = null;
        $qrSvg = null;

        if ($asset->acknowledgementReceipt?->signed_at) {
            $qrPayload = $qrCodeService->buildScanUrl($asset->qr_code_token);
            $qrSvg = $qrCodeService->generateSvg($qrPayload);
        }

        $pieceQrSvgs = [];
        foreach ($asset->pieces as $piece) {
            if ($piece->qr_code_token) {
                $payload = $qrCodeService->buildScanUrl($piece->qr_code_token);
                $pieceQrSvgs[$piece->id] = $qrCodeService->generateSvg($payload);
            }
        }

        foreach ($relatedAssets as $sibling) {
            foreach ($sibling->pieces as $piece) {
                if ($piece->qr_code_token) {
                    $payload = $qrCodeService->buildScanUrl($piece->qr_code_token);
                    $pieceQrSvgs[$piece->id] = $qrCodeService->generateSvg($payload);
                }
            }
        }

        return Inertia::render('Assets/Show', [
            'asset' => $asset->load([
                'pieces',
                'documents.uploadedBy',
                'documents.verifiedBy',
                'acknowledgementReceipt',
                'jev',
                'disposals.donation',
                'disposals.disposalJev',
                'incident',
                'qrScans.scannedBy',
                'statusHistory.changedBy.roles',
            ]),
            'qrPayload' => $qrPayload,
            'allStatusHistory' => $allStatusHistory,
            'qrSvg' => $qrSvg,
            'pieceQrSvgs' => $pieceQrSvgs, 
            'relatedAssets' => $relatedAssets,
            'requiredDocumentTypes' => collect($asset->requiredDocumentTypes())->map(fn ($t) => [
                'value' => $t->value,
                'label' => $t->label(),
            ]),
            'speciesOptions' => [
                'Narra', 'Coco Lumber', 'Mahogany', 'Molave', 'Yakal', 'Ipil',
                'Kamagong', 'Tanguile', 'Lauan', 'Apitong', 'Gmelina', 'Falcata',
                'Bamboo', 'Others',
            ],
            'equipmentOptions' => [
                'Chainsaw', 'Power Saw', 'Handheld Circular Saw',
                'Winch / Cable Puller', 'Hand Tools (Axe, Bolo, Wedge)', 'Others',
            ],
            'modes' => collect(AssetMode::cases())->map(fn ($m) => [
                'value' => $m->value,
                'label' => $m->label(),
            ]),
            'hasAllRequiredDocuments' => $asset->hasAllRequiredDocuments(),
            'can' => [
                'submitForCustodyReview' => $request->user()->can('submitForCustodyReview', $asset),
                'submitAapForReview' => $request->user()?->can('submitAapForReview', $asset) ?? false,
                'resolveCustodyReview'   => $request->user()->can('resolveCustodyReview', $asset),
                'markStored'        => $request->user()?->can('markStored', $asset) ?? false,
                'generateQr'        => $request->user()?->can('generateQr', $asset) ?? false,
                'updateAap'         => $request->user()?->can('updateAap', $asset) ?? false,
                'createJev'         => $request->user()?->can('create', \App\Models\Jev::class) ?? false,
                'uploadJev'         => $asset->jev ? ($request->user()?->can('upload', $asset->jev) ?? false) : false,
                'resolveCase'       => $request->user()?->can('updateCaseStatus', $asset) ?? false,
                'releaseDonation'   => $request->user()?->can('disposals.process') ?? false,
                'processDisposal'   => $request->user()?->can('create', \App\Models\Disposal::class) ?? false,
                'updateCaseDetails' => $asset->has_ongoing_case && ($request->user()?->can('assets.update_case') ?? false),
                'uploadEvidence'    => $request->user()?->can('documents.upload') ?? false,
                'verifyDocuments'   => $request->user()?->can('documents.verify') ?? false,
                'issueJevOut'       => $request->user()?->can('jev.create') ?? false,
                'uploadJevOut'      => $request->user()?->can('jev.upload') ?? false,
                'edit'              => $request->user()?->can('assets.update') ?? false,
            ],
            'aapDocumentUploaded' => $asset->hasAapDocument(),
            'documentReviewStatus' => (function () use ($asset) {
                $required = $asset->requiredDocumentTypes();
                $docs = $asset->documents()
                    ->whereIn('document_type', array_map(fn ($t) => $t->value, $required))
                    ->get()
                    ->groupBy(fn ($d) => $d->getRawOriginal('document_type'))
                    ->map(fn ($group) => $group->sortByDesc('id')->first());

                $statuses = collect($required)->map(function ($type) use ($docs) {
                    $doc = $docs->get($type->value);
                    $status = $doc ? $doc->getRawOriginal('status') : 'missing';
                    return $status;
                });

                $allVerified = $statuses->every(fn ($s) => $s === 'verified');
                $anyRejected = $statuses->contains('rejected');
                $anyPending  = $statuses->contains('pending');
                $anyMissing  = $statuses->contains('missing');

                return [
                    'all_verified' => $allVerified,
                    'any_rejected' => $anyRejected,
                    'can_approve'  => $allVerified,
                    'can_return'   => $anyRejected && !$anyPending && !$anyMissing,
                    'show_panel'   => $allVerified || ($anyRejected && !$anyPending && !$anyMissing),
                ];
            })(),
        ]);
    }
    

    public function byCode(Request $request, string $assetCode)
    {
        $items = Asset::where('asset_code', $assetCode)
            ->with(['acknowledgementReceipt', 'creator', 'jev', 'disposals.donation', 'pieces'])
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

        Asset::where('asset_code', $asset->asset_code)
            ->update(['aap_number' => $request->validated('aap_number')]);

        $auditLog->log('asset.aap_number_updated', $asset, $before, $asset->fresh()->only('aap_number'), $request->user()->id);

        return back()->with('success', 'AAP No. updated.');
    }

    public function updateStcpNumber(UpdateStcpNumberRequest $request, Asset $asset, \App\Services\AuditLogService $auditLog): RedirectResponse
    {
        $before = $asset->only('stcp_number');

        Asset::where('asset_code', $asset->asset_code)
            ->update(['stcp_number' => $request->validated('stcp_number')]);

        $auditLog->log('asset.stcp_number_updated', $asset, $before, $asset->fresh()->only('stcp_number'), $request->user()->id);

        return back()->with('success', 'STCP No. updated.');
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
        $assetFields = [
            'location_apprehended', 'apprehending_agency', 'mode',
            'has_ongoing_case', 'has_confiscation_order',
        ];

        $before = $asset->only($assetFields);

        $asset->update($request->only($assetFields));

        if ($asset->incident_id) {
            $incidentFields = [
                'date_of_apprehension', 'place_of_apprehension',
                'area', 'coordinates', 'apprehending_party',
            ];

            $incidentData = array_filter(
                $request->only($incidentFields),
                fn ($v) => $v !== null,
            );

            if ($request->has('has_claimant')) {
                $hasClaimant = (bool) $request->has_claimant;
                $incidentData['is_abandoned'] = ! $hasClaimant;
                $incidentData['claimant_offender_name'] = $hasClaimant
                    ? $request->claimant_offender_name
                    : null;
                $incidentData['claimant_address'] = $hasClaimant
                    ? $request->claimant_address
                    : null;
                $incidentData['claimant_contact_number'] = $hasClaimant
                    ? $request->claimant_contact_number
                    : null;
                $incidentData['claimant_id_type'] = $hasClaimant
                    ? $request->claimant_id_type
                    : null;
                $incidentData['claimant_id_number'] = $hasClaimant
                    ? $request->claimant_id_number
                    : null;
            }

            if (! empty($incidentData)) {
                $asset->incident()->update($incidentData);
            }
        }

        $auditLog->log(
            'asset.updated',
            $asset,
            $before,
            $asset->fresh()->only($assetFields),
            $request->user()->id,
        );

        return back()->with('success', 'Asset updated successfully.');
    }

    public function submitForCustodyReview(Asset $asset, SubmitForCustodyReview $action): \Illuminate\Http\RedirectResponse
    {
        $this->authorize('submitForCustodyReview', $asset);

        $action->execute($asset);

        return back()->with('success', 'Asset submitted for custody review.');
    }

    public function resolveCustodyReview(Asset $asset, ResolveCustodyReview $action): \Illuminate\Http\RedirectResponse
    {
        $this->authorize('resolveCustodyReview', $asset);

        $validated = request()->validate([
            'decision' => ['required', 'in:approved,returned'],
            'remarks'  => ['nullable', 'string', 'max:1000'],
        ]);

        $action->execute($asset, $validated['decision'], $validated['remarks'] ?? null);

        return back()->with('success', 'Custody review ' . $validated['decision'] . '.');
    }

    public function submitAapForReview(Asset $asset, SubmitAapForReview $action): RedirectResponse
    {
        $this->authorize('submitAapForReview', $asset);

        $action->execute($asset);

        return back()->with('success', 'AAP document submitted for verification. Custodian has been notified.');
    }
}