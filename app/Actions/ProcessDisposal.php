<?php

namespace App\Actions;

use App\Enums\AssetStatus;
use App\Enums\DisposalType;
use App\Enums\Municipality;
use App\Models\Asset;
use App\Models\AssetCaseStatusHistory;
use App\Models\Disposal;
use App\Models\Donation;
use App\Models\IcsRecord;
use App\Models\ParRecord;
use App\Models\User;
use App\Services\AssetCodeService;
use App\Services\AssetLifecycleService;
use App\Services\AuditLogService;
use App\Services\PdfDocumentService;
use App\Services\QrCodeService;
use DomainException;
use Illuminate\Support\Facades\DB;

class ProcessDisposal
{
    public function __construct(
        protected AssetLifecycleService $lifecycleService,
        protected PdfDocumentService $pdfDocumentService,
        protected AuditLogService $auditLogService,
        protected QrCodeService $qrCodeService,
        protected AssetCodeService $assetCodeService,
    ) {}

    /**
     * @param  int|null  $quantity  How many units of $asset are being disposed of
     *                              this time. Defaults to the asset's full quantity.
     *                              If less than the asset's quantity, the leftover
     *                              is split off into a new asset record and sent
     *                              back to storage rather than being disposed of.
     */
    public function execute(Asset $asset, DisposalType $type, User $user, array $details = [], ?int $quantity = null): Disposal
    {
        if ($asset->current_status !== AssetStatus::ForDisposal) {
            throw new DomainException('Asset is not marked for disposal.');
        }

        $allowed = $this->lifecycleService->allowedDisposalTypes($asset);
        if (! in_array($type, $allowed, true)) {
            throw new DomainException("Disposal type {$type->value} is not allowed for this asset type.");
        }

        if ($asset->disposal) {
            throw new DomainException('Disposal already processed for this asset.');
        }

        $assetQuantity = $asset->quantity ?? 1;
        $quantity = $quantity ?? $assetQuantity;

        if ($quantity < 1 || $quantity > $assetQuantity) {
            throw new DomainException('Disposal quantity must be between 1 and the asset\'s current quantity.');
        }

        return DB::transaction(function () use ($asset, $type, $user, $details, $quantity, $assetQuantity) {
            $remainderQuantity = $assetQuantity - $quantity;

            if ($remainderQuantity > 0) {
                $this->splitRemainderToStorage($asset, $remainderQuantity, $user);
                $asset->update(['quantity' => $quantity]);
                $asset->refresh();
            }

            $disposal = Disposal::create([
                'asset_id' => $asset->id,
                'disposal_type' => $type,
                'details' => $details,
                'processed_by' => $user->id,
                'processed_at' => now(),
            ]);

            match ($type) {
                DisposalType::Donation => $this->handleDonation($asset, $disposal, $details),
                DisposalType::Decayed => $this->pdfDocumentService->generateDecayReport($asset, $disposal),
                DisposalType::Fabricated => $this->handleFabricated($asset, $disposal, $user, $details),
                DisposalType::Released => $this->pdfDocumentService->generateVehicleRelease($asset, $disposal),
                DisposalType::Forfeited => $this->pdfDocumentService->generateVehicleForfeiture($asset, $disposal),
                default => null,
            };

            $this->lifecycleService->transition(
                $asset->fresh(),
                $type->resultingStatus(),
                $user,
                "Disposal processed: {$type->label()} ({$quantity} of {$assetQuantity} unit(s)).",
                'disposal.processed',
            );

            $this->auditLogService->log('disposal.processed', $disposal, null, $disposal->toArray(), $user->id);

            return $disposal->fresh(['donation', 'icsRecord', 'parRecord']);
        });
    }

    /**
     * Split off the undisposed remainder of $original into a brand-new asset
     * record, sent straight back to Stored. It gets its own asset_code and
     * QR token — physically it's the same pile of logs, but from here on
     * it's tracked as a separate inventory item that can go through its own
     * disposal later.
     */
    protected function splitRemainderToStorage(Asset $original, int $remainderQuantity, User $user): Asset
    {
        $remainder = Asset::create([
            'incident_id' => $original->incident_id,
            'asset_code' => 'PENDING',
            'type' => $original->type,
            'species' => $original->species,
            'description' => $original->description,
            'quantity' => $remainderQuantity,
            'volume_bd_ft' => null,
            'volume_cu_m' => null,
            'estimated_value' => null,
            'plate_number' => $original->plate_number,
            'municipality_of_origin' => $original->municipality_of_origin,
            'location_apprehended' => $original->location_apprehended,
            'apprehending_agency' => $original->apprehending_agency,
            'mode' => $original->mode,
            'has_ongoing_case' => $original->has_ongoing_case,
            'has_confiscation_order' => $original->has_confiscation_order,
            'current_status' => AssetStatus::Stored,
            'qr_code_token' => $this->qrCodeService->generateToken(),
            'metadata' => $original->metadata,
            'created_by' => $user->id,
        ]);

        $remainder->update([
            'asset_code' => $this->assetCodeService->generate(
                $remainder,
                Municipality::from($original->municipality_of_origin),
                $original->has_ongoing_case,
            ),
        ]);

        AssetCaseStatusHistory::create([
            'asset_id' => $remainder->id,
            'status' => AssetStatus::Stored,
            'changed_by' => $user->id,
            'notes' => "Split from {$original->asset_code} — {$remainderQuantity} unit(s) not selected for disposal, returned to storage.",
            'changed_at' => now(),
        ]);

        $this->auditLogService->log('asset.split_for_partial_disposal', $remainder, null, $remainder->toArray(), $user->id);

        return $remainder;
    }

    protected function handleDonation(Asset $asset, Disposal $disposal, array $details): void
    {
        $donation = Donation::create([
            'disposal_id' => $disposal->id,
            'requester_name' => $details['requester_name'] ?? 'Unknown Requester',
            'organization_type' => $details['organization_type'] ?? null,
            'organization_type_other' => $details['organization_type_other'] ?? null,
            'agency_name' => $details['agency_name'] ?? null,
            'released_at' => isset($details['released_at']) ? \Carbon\Carbon::parse($details['released_at']) : null,
        ]);

        $this->pdfDocumentService->generateDeedOfDonation($asset, $disposal, $donation);
        $this->pdfDocumentService->generateDonationWaybill($asset, $disposal, $donation);
    }

    protected function handleFabricated(Asset $asset, Disposal $disposal, User $user, array $details): void
    {
        $ics = IcsRecord::create([
            'disposal_id' => $disposal->id,
            'document_number' => 'ICS-'.now()->format('Y').'-'.str_pad((string) $disposal->id, 5, '0', STR_PAD_LEFT),
            'issued_by' => $user->id,
            'issued_at' => now(),
        ]);

        $par = ParRecord::create([
            'disposal_id' => $disposal->id,
            'document_number' => 'PAR-'.now()->format('Y').'-'.str_pad((string) $disposal->id, 5, '0', STR_PAD_LEFT),
            'issued_by' => $user->id,
            'issued_at' => now(),
        ]);

        $this->pdfDocumentService->generateIcs($asset, $ics);
        $this->pdfDocumentService->generatePar($asset, $par);
    }
}