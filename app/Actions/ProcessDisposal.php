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

    public function execute(Asset $asset, DisposalType $type, User $user, array $details = []): Disposal
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

        return DB::transaction(function () use ($asset, $type, $user, $details) {
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
                "Disposal processed: {$type->label()}.",
                'disposal.processed',
            );

            $this->auditLogService->log('disposal.processed', $disposal, null, $disposal->toArray(), $user->id);

            return $disposal->fresh(['donation', 'icsRecord', 'parRecord']);
        });
    }

    protected function handleDonation(Asset $asset, Disposal $disposal, array $details): void
    {
        $requesterName = $details['requester_name'] ?? 'Unknown Requester';
        $deedPath = $this->pdfDocumentService->generateDeedOfDonation($asset, $disposal, $requesterName);

        Donation::create([
            'disposal_id' => $disposal->id,
            'requester_name' => $requesterName,
            'deed_of_donation_path' => $deedPath,
            'released_at' => isset($details['released_at']) ? \Carbon\Carbon::parse($details['released_at']) : null,
        ]);
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