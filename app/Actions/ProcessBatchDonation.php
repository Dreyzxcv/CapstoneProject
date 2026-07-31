<?php
// app/Actions/ProcessBatchDonation.php

namespace App\Actions;

use App\Enums\AssetStatus;
use App\Enums\AssetType;
use App\Enums\DisposalType;
use App\Models\Asset;
use App\Models\Disposal;
use App\Models\Donation;
use App\Models\User;
use App\Services\AssetLifecycleService;
use App\Services\AuditLogService;
use App\Services\PdfDocumentService;
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

            $remaining = $asset->remainingQuantity();

            if ($remaining <= 0) {
                throw new DomainException("{$asset->asset_code} has already been fully disposed.");
            }

            $quantity = $line['quantity'] ?? $remaining;

            if ($quantity < 1 || $quantity > $remaining) {
                throw new DomainException("Quantity for {$asset->asset_code} must be between 1 and {$remaining} (the remaining, undisposed amount).");
            }
        }

        return DB::transaction(function () use ($lines, $assets, $donationDetails, $user) {
            $batchId = (string) Str::uuid();
            $disposals = collect();

            foreach ($lines as $line) {
                $asset = $assets->get($line['asset_id'])->fresh();
                $remaining = $asset->remainingQuantity();
                $quantity = $line['quantity'] ?? $remaining;

                $disposal = Disposal::create([
                    'asset_id' => $asset->id,
                    'donation_batch_id' => $batchId,
                    'disposal_type' => DisposalType::Donation,
                    'quantity' => $quantity,
                    'details' => $donationDetails,
                    'processed_by' => $user->id,
                    'processed_at' => now(),
                ]);

                $asset->increment('disposed_quantity', $quantity);
                $asset->refresh();

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

                if ($asset->isFullyDisposed()) {
                    $this->lifecycleService->transition(
                        $asset,
                        DisposalType::Donation->resultingStatus(),
                        $user,
                        "Disposal processed: Donation ({$quantity} of {$asset->quantity} unit(s)) — fully disposed, part of a multi-asset donation.",
                        'disposal.processed',
                    );
                } else {
                    $this->auditLogService->log(
                        'disposal.partial_processed',
                        $disposal,
                        null,
                        ['quantity' => $quantity, 'remaining' => $asset->remainingQuantity()],
                        $user->id,
                    );
                }

                $disposals->push($disposal->fresh(['donation', 'asset']));
            }

            $this->auditLogService->log('donation.batch_created', null, null, [
                'donation_batch_id' => $batchId,
                'asset_ids' => collect($lines)->pluck('asset_id')->all(),
            ], $user->id);

            return $disposals;
        });
    }
}