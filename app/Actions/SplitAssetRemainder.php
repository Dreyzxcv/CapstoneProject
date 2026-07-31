<?php
namespace App\Actions;

use App\Enums\AssetStatus;
use App\Enums\Municipality;
use App\Models\Asset;
use App\Models\AssetCaseStatusHistory;
use App\Models\User;
use App\Services\AssetCodeService;
use App\Services\AuditLogService;
use App\Services\QrCodeService;

class SplitAssetRemainder
{
    public function __construct(
        protected QrCodeService $qrCodeService,
        protected AssetCodeService $assetCodeService,
        protected AuditLogService $auditLogService,
    ) {}

    public function execute(Asset $original, int $remainderQuantity, User $user): Asset
    {
        $remainingBefore = $original->remainingQuantity();
        $ratio = $remainingBefore > 0 ? $remainderQuantity / $remainingBefore : 0;

        $split = Asset::create([
            'incident_id' => $original->incident_id,
            'asset_code' => 'PENDING',
            'type' => $original->type,
            'species' => $original->species,
            'description' => $original->description,
            'quantity' => $remainderQuantity,
            'volume_bd_ft' => $original->volume_bd_ft !== null
                ? round((float) $original->remainingVolumeBdFt() * $ratio, 2) : null,
            'volume_cu_m' => $original->volume_cu_m !== null
                ? round((float) $original->volume_cu_m * $ratio, 4) : null,
            'estimated_value' => $original->estimated_value !== null
                ? round((float) $original->estimated_value * $ratio, 2) : null,
            'plate_number' => $original->plate_number,
            'municipality_of_origin' => $original->municipality_of_origin,
            'location_apprehended' => $original->location_apprehended,
            'apprehending_agency' => $original->apprehending_agency,
            'mode' => $original->mode,
            'has_ongoing_case' => $original->has_ongoing_case,
            'has_confiscation_order' => $original->has_confiscation_order,
            'case_number' => $original->case_number,
            'court_branch' => $original->court_branch,
            'next_hearing_date' => $original->next_hearing_date,
            'current_status' => AssetStatus::Stored,
            'qr_code_token' => $this->qrCodeService->generateToken(),
            'metadata' => $original->metadata,
            'created_by' => $user->id,
        ]);

        $split->update([
            'asset_code' => $this->assetCodeService->generate(
                $split,
                Municipality::from($split->municipality_of_origin),
                $split->has_ongoing_case,
            ).'-R',
        ]);

        AssetCaseStatusHistory::create([
            'asset_id' => $split->id,
            'status' => AssetStatus::Stored,
            'changed_by' => $user->id,
            'notes' => "Split from {$original->asset_code} — {$remainderQuantity} unit(s) not part of this disposal, returned to storage.",
            'changed_at' => now(),
        ]);

        $this->auditLogService->log('asset.split_remainder', $split, null, $split->toArray(), $user->id);

        return $split->fresh();
    }
}