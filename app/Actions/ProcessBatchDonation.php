<?php
// app/Actions/ProcessBatchDonation.php

namespace App\Actions;

use App\Enums\AssetStatus;
use App\Enums\AssetType;
use App\Enums\DisposalType;
use App\Models\Asset;
use App\Models\AssetPiece;
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
     * @param array<int, array{asset_id: int, quantity: int, piece_ids?: array<int>}> $lines
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

            // Lines built from scanned QR pieces carry piece_ids — each piece
            // is exactly one unit. Validate the count matches the quantity
            // and reject any piece that's already disposed. This is what
            // actually stops a re-scanned, already-donated piece from being
            // donated again; without it, only the asset-level count was
            // ever checked, which stays > 0 as long as ANY piece remains.
            $pieceIds = array_values(array_unique($line['piece_ids'] ?? []));

            if (! empty($pieceIds)) {
                if (count($pieceIds) !== (int) $quantity) {
                    throw new DomainException("Selected piece count for {$asset->asset_code} does not match the quantity entered.");
                }

                $pieces = AssetPiece::whereIn('id', $pieceIds)
                    ->where('asset_id', $asset->id)
                    ->get();

                if ($pieces->count() !== count($pieceIds)) {
                    throw new DomainException("One or more scanned pieces do not belong to {$asset->asset_code}.");
                }

                if ($pieces->contains(fn (AssetPiece $piece) => $piece->disposed_at !== null)) {
                    throw new DomainException("One or more scanned pieces of {$asset->asset_code} have already been disposed.");
                }
            }
        }

        return DB::transaction(function () use ($lines, $assets, $donationDetails, $user) {
            $batchId = (string) Str::uuid();
            $disposals = collect();

            foreach ($lines as $line) {
                $asset = $assets->get($line['asset_id'])->fresh();
                $remaining = $asset->remainingQuantity();
                $quantity = $line['quantity'] ?? $remaining;
                $pieceIds = array_values(array_unique($line['piece_ids'] ?? []));

                $volumeForThisDisposal = null;
                if ($asset->volume_bd_ft !== null && $remaining > 0) {
                    $remainingVolume = (float) $asset->remainingVolumeBdFt();
                    $volumeForThisDisposal = round(($remainingVolume / $remaining) * $quantity, 2);
                }

                $disposal = Disposal::create([
                    'asset_id' => $asset->id,
                    'donation_batch_id' => $batchId,
                    'disposal_type' => DisposalType::Donation,
                    'quantity' => $quantity,
                    'volume_bd_ft' => $volumeForThisDisposal,
                    'details' => $donationDetails,
                    'processed_by' => $user->id,
                    'processed_at' => now(),
                ]);

                if (! empty($pieceIds)) {
                    AssetPiece::whereIn('id', $pieceIds)
                        ->where('asset_id', $asset->id)
                        ->update([
                            'disposal_id' => $disposal->id,
                            'disposed_at' => now(),
                        ]);
                }

                $asset->increment('disposed_quantity', $quantity);
                if ($volumeForThisDisposal !== null) {
                    $asset->increment('disposed_volume_bd_ft', $volumeForThisDisposal);
                }
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

                    'donee_position' => $donationDetails['donee_position'] ?? null,
                    'purpose_statement' => $donationDetails['purpose_statement'] ?? null,
                    'confiscation_order_reference' => $donationDetails['confiscation_order_reference'] ?? null,
                    'donor_representative_name' => $donationDetails['donor_representative_name'] ?? null,
                    'donor_representative_title' => $donationDetails['donor_representative_title'] ?? null,
                    'witness_1_name' => $donationDetails['witness_1_name'] ?? null,
                    'witness_1_title' => $donationDetails['witness_1_title'] ?? null,
                    'witness_2_name' => $donationDetails['witness_2_name'] ?? null,
                    'witness_2_title' => $donationDetails['witness_2_title'] ?? null,
                ]);

                $this->pdfDocumentService->generateDeedOfDonation($asset, $disposal, $donation);

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