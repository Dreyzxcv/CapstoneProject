<?php

namespace App\Actions;

use App\Enums\AssetStatus;
use App\Enums\DisposalType;
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

        return DB::transaction(function () use ($donation, $user, $photo, $asset) {
            $before = $donation->toArray();

            $updates = ['released_at' => now()];
            if ($photo) {
                $updates['release_photo_path'] = $photo->store('documents/donations/release-photos', 'local');
            }

            $donation->update($updates);

            $this->auditLogService->log('donation.released', $donation, $before, $donation->fresh()->toArray(), $user->id);

            // Only push the AAP to its terminal "Donated" status once every
            // unit has been disposed AND every donation tied to this asset
            // has been physically released — one AAP can now carry more
            // than one donation disposal event over time.
            $hasUnreleasedDonations = $asset->disposals()
                ->where('disposal_type', DisposalType::Donation->value)
                ->whereHas('donation', fn ($q) => $q->whereNull('released_at'))
                ->exists();

            if ($asset->isFullyDisposed() && ! $hasUnreleasedDonations && $asset->current_status !== AssetStatus::Donated) {
                $this->lifecycleService->transition(
                    $asset,
                    AssetStatus::Donated,
                    $user,
                    'All donations for this AAP confirmed released/delivered to donee(s).',
                    'donation.released',
                );
            }

            return $donation->fresh();
        });
    }
}