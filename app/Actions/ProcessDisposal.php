<?php

namespace App\Actions;

use App\Enums\AssetStatus;
use App\Enums\DisposalType;
use App\Models\Asset;
use App\Models\Disposal;
use App\Models\Donation;
use App\Models\IcsRecord;
use App\Models\ParRecord;
use App\Models\User;
use App\Services\AssetLifecycleService;
use App\Services\AuditLogService;
use App\Services\PdfDocumentService;
use DomainException;
use Illuminate\Support\Facades\DB;

class ProcessDisposal
{
    public function __construct(
        protected AssetLifecycleService $lifecycleService,
        protected PdfDocumentService $pdfDocumentService,
        protected AuditLogService $auditLogService,
    ) {}

    public function execute(Asset $asset, DisposalType $type, User $user, array $details = [], ?int $quantity = null): Disposal
    {
        if ($asset->current_status !== AssetStatus::ForDisposal) {
            throw new DomainException('Asset is not marked for disposal.');
        }

        $allowed = $this->lifecycleService->allowedDisposalTypes($asset);
        if (! in_array($type, $allowed, true)) {
            throw new DomainException("Disposal type {$type->value} is not allowed for this asset type.");
        }

        $remaining = $asset->remainingQuantity();

        if ($remaining <= 0) {
            throw new DomainException('This AAP has already been fully disposed.');
        }

        $quantity = $quantity ?? $remaining;

        if ($quantity < 1 || $quantity > $remaining) {
            throw new DomainException("Disposal quantity must be between 1 and {$remaining} (the remaining, undisposed amount).");
        }

        return DB::transaction(function () use ($asset, $type, $user, $details, $quantity, $remaining) {
            // Proportional volume for this slice, if the asset tracks board-feet.
            $volumeForThisDisposal = null;
            if ($asset->volume_bd_ft !== null && $remaining > 0) {
                $perUnit = (float) $asset->remainingVolumeBdFt() / $remaining;
                $volumeForThisDisposal = round($perUnit * $quantity, 2);
            }

            $disposal = Disposal::create([
                'asset_id' => $asset->id,
                'disposal_type' => $type,
                'quantity' => $quantity,
                'volume_bd_ft' => $volumeForThisDisposal,
                'details' => $details,
                'processed_by' => $user->id,
                'processed_at' => now(),
            ]);

            // NEVER touch quantity/volume_bd_ft/volume_cu_m — those stay as
            // originally apprehended. Only the disposed_* counters move.
            $asset->increment('disposed_quantity', $quantity);
            if ($volumeForThisDisposal !== null) {
                $asset->increment('disposed_volume_bd_ft', $volumeForThisDisposal);
            }

            match ($type) {
                DisposalType::Donation => $this->handleDonation($asset, $disposal, $details),
                DisposalType::Decayed => $this->pdfDocumentService->generateDecayReport($asset, $disposal),
                DisposalType::Fabricated => $this->handleFabricated($asset, $disposal, $user, $details),
                DisposalType::Released => $this->pdfDocumentService->generateVehicleRelease($asset, $disposal),
                DisposalType::Forfeited => $this->pdfDocumentService->generateVehicleForfeiture($asset, $disposal),
                default => null,
            };

            $asset->refresh();

            if ($asset->isFullyDisposed()) {
                $this->lifecycleService->transition(
                    $asset,
                    $type->resultingStatus(),
                    $user,
                    "Disposal processed: {$type->label()} ({$quantity} of {$asset->quantity} unit(s) — fully disposed).",
                    'disposal.processed',
                );
            } else {
                // Remaining pieces of the same AAP are still awaiting disposal;
                // status stays For Disposal, but log it for the audit trail/history.
                $this->auditLogService->log(
                    'disposal.partial_processed',
                    $disposal,
                    null,
                    ['quantity' => $quantity, 'remaining' => $asset->remainingQuantity()],
                    $user->id,
                );
            }

            return $disposal->fresh(['donation', 'icsRecord', 'parRecord']);
        });
    }

    protected function handleDonation(Asset $asset, Disposal $disposal, array $details): void
    {
        $donation = Donation::create([
            'disposal_id' => $disposal->id,
            'requester_name' => $details['requester_name'] ?? 'Unknown Requester',
            'organization_type' => $details['organization_type'] ?? null,
            'organization_type_other' => $details['organization_type_other'] ?? null,
            'agency_name' => $details['agency_name'] ?? null,
            'municipality' => $details['municipality'] ?? null,
            'barangay' => $details['barangay'] ?? null,
            'street' => $details['street'] ?? null,
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