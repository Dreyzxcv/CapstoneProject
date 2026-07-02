<?php

namespace App\Actions;

use App\Enums\AssetStatus;
use App\Enums\AssetType;
use App\Models\Asset;
use App\Models\Jev;
use App\Models\User;
use App\Services\AssetLifecycleService;
use App\Services\AuditLogService;
use DomainException;
use Illuminate\Support\Facades\DB;

class UploadJev
{
    public function __construct(
        protected AssetLifecycleService $lifecycleService,
        protected AuditLogService $auditLogService,
    ) {}

    public function execute(Asset $asset, Jev $jev, User $mesUser): Jev
    {
        if ($jev->asset_id !== $asset->id) {
            throw new DomainException('JEV does not belong to this asset.');
        }

        if ($jev->uploaded_at !== null) {
            throw new DomainException('JEV has already been uploaded.');
        }

        if ($asset->current_status !== AssetStatus::ClearedForAccounting) {
            throw new DomainException('Asset is not awaiting JEV upload.');
        }

        return DB::transaction(function () use ($asset, $jev, $mesUser) {
            $jev->update([
                'uploaded_by_mes_id' => $mesUser->id,
                'uploaded_at' => now(),
            ]);

            $updates = [];
            if ($asset->type === AssetType::Vehicle) {
                // Owner has 15 days from this point to appeal before release/forfeiture is decided.
                $updates['appeal_deadline'] = now()->addDays(15);
            }

            if ($updates !== []) {
                $asset->update($updates);
            }

            $this->lifecycleService->transition(
                $asset->fresh(),
                AssetStatus::ForDisposal,
                $mesUser,
                "JEV {$jev->jev_number} uploaded by MES.",
                'jev.uploaded',
            );

            $this->auditLogService->log('jev.uploaded', $jev, null, $jev->fresh()->toArray(), $mesUser->id);

            return $jev->fresh();
        });
    }
}
