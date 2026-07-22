<?php

namespace App\Actions;

use App\Enums\AssetStatus;
use App\Models\Disposal;
use App\Models\Donation;
use App\Models\User;
use App\Services\AssetLifecycleService;
use App\Services\AuditLogService;
use DomainException;
use Illuminate\Support\Facades\DB;

class ReleaseDonation
{
    public function __construct(
        protected AuditLogService $auditLogService,
        protected AssetLifecycleService $lifecycleService,
    ) {}

    public function execute(Disposal $disposal, User $user, ?\Illuminate\Http\UploadedFile $photo = null): Donation
    {
        $donation = $disposal->donation;

        if (! $donation) {
            throw new DomainException('This disposal has no associated donation.');
        }

        if ($donation->released_at !== null) {
            throw new DomainException('Donation has already been released.');
        }

        $asset = $disposal->asset;

        if ($asset->current_status !== AssetStatus::PendingRelease) {
            throw new DomainException('Asset is not awaiting release.');
        }

        return DB::transaction(function () use ($donation, $user, $photo, $asset) {
            $before = $donation->toArray();

            $updates = ['released_at' => now()];
            if ($photo) {
                $updates['release_photo_path'] = $photo->store('documents/donations/release-photos', 'local');
            }

            $donation->update($updates);

            $this->lifecycleService->transition(
                $asset,
                AssetStatus::Donated,
                $user,
                'Donation confirmed released/delivered to donee.',
                'donation.released',
            );

            $this->auditLogService->log('donation.released', $donation, $before, $donation->fresh()->toArray(), $user->id);

            return $donation->fresh();
        });
    }
}