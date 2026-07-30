<?php
// app/Actions/ProcessBatchDonation.php

namespace App\Actions;

use App\Enums\AssetStatus;
use App\Enums\AssetType;
use App\Enums\DisposalType;
use App\Enums\Municipality;
use App\Models\Asset;
use App\Models\AssetCaseStatusHistory;
use App\Models\Disposal;
use App\Models\Donation;
use App\Models\User;
use App\Services\AssetCodeService;
use App\Services\AssetLifecycleService;
use App\Services\AuditLogService;
use App\Services\PdfDocumentService;
use App\Services\QrCodeService;
use DomainException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProcessBatchDonation
{
    public function __construct(
        protected AssetLifecycleService $lifecycleService,
        protected PdfDocumentService $pdfDocumentService,
        protected AuditLogService $auditLogService,
        protected QrCodeService $qrCodeService,
        protected AssetCodeService $assetCodeService,
    ) {}

    /**
     * @param array<int, array{asset_id: int, quantity: int}> $lines
     * @param array $donationDetails Shared donee info: requester_name, organization_type, agency_name,
     *                                municipality, barangay, street, delivery_coordinates, notes.
     */
    public function execute(array $lines, array $donationDetails, User $user): Collection
    {
        if (empty($lines)) {
            throw new DomainException('Select at least one asset to donate.');
        }

        $assets = Asset::whereIn('id', collect($lines)->pluck('asset_id'))->get()->keyBy('id');

        // Validate every line before touching the database.
        foreach ($lines as $line) {
            $asset = $assets->get($line['asset_id']);

            if (! $asset) {
                throw new DomainException("Asset #{$line['asset_id']} not found.");
            }

            if ($asset->type !== AssetType::Log) {
                throw new DomainException("{$asset->asset_code} is not a log asset and cannot be donated.");
            }

            if ($asset->current_status !== AssetStatus::ForDisposal) {
                throw new DomainException("{$asset->asset_code} is not marked for disposal.");
            }

            if ($asset->disposal) {
                throw new DomainException("{$asset->asset_code} already has a disposal recorded.");
            }

            $assetQuantity = $asset->quantity ?? 1;
            $quantity = $line['quantity'] ?? $assetQuantity;

            if ($quantity < 1 || $quantity > $assetQuantity) {
                throw new DomainException("Quantity for {$asset->asset_code} must be between 1 and {$assetQuantity}.");
            }
        }

        return DB::transaction(function () use ($lines, $assets, $donationDetails, $user) {
            $batchId = (string) Str::uuid();
            $disposals = collect();

            foreach ($lines as $line) {
                $asset = $assets->get($line['asset_id'])->fresh();
                $assetQuantity = $asset->quantity ?? 1;
                $quantity = $line['quantity'] ?? $assetQuantity;
                $remainderQuantity = $assetQuantity - $quantity;

                if ($remainderQuantity > 0) {
                    $this->splitRemainderToStorage($asset, $remainderQuantity, $user);
                    $asset->update(['quantity' => $quantity]);
                    $asset->refresh();
                }

                $disposal = Disposal::create([
                    'asset_id' => $asset->id,
                    'donation_batch_id' => $batchId,
                    'disposal_type' => DisposalType::Donation,
                    'details' => $donationDetails,
                    'processed_by' => $user->id,
                    'processed_at' => now(),
                ]);

                $donation = Donation::create([
                    'disposal_id' => $disposal->id,
                    'requester_name' => $donationDetails['requester_name'] ?? 'Unknown Requester',
                    'organization_type' => $donationDetails['organization_type'] ?? null,
                    'organization_type_other' => $donationDetails['organization_type_other'] ?? null,
                    'agency_name' => $donationDetails['agency_name'] ?? null,
                    'municipality' => $donationDetails['municipality'] ?? null,
                    'barangay' => $donationDetails['barangay'] ?? null,
                    'street' => $donationDetails['street'] ?? null,
                ]);

                $this->pdfDocumentService->generateDeedOfDonation($asset, $disposal, $donation);
                $this->pdfDocumentService->generateDonationWaybill($asset, $disposal, $donation);

                $this->lifecycleService->transition(
                    $asset->fresh(),
                    DisposalType::Donation->resultingStatus(),
                    $user,
                    "Disposal processed: Donation ({$quantity} of {$assetQuantity} unit(s)) — part of a multi-asset donation.",
                    'disposal.processed',
                );

                $this->auditLogService->log('disposal.processed', $disposal, null, $disposal->toArray(), $user->id);

                $disposals->push($disposal->fresh(['donation', 'asset']));
            }

            $this->auditLogService->log('donation.batch_created', null, null, [
                'donation_batch_id' => $batchId,
                'asset_ids' => collect($lines)->pluck('asset_id')->all(),
            ], $user->id);

            return $disposals;
        });
    }

    /**
     * Duplicated from ProcessDisposal::splitRemainderToStorage — same behavior,
     * kept local so this action doesn't depend on ProcessDisposal directly.
     * Worth extracting into a shared service if a third caller shows up.
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
}