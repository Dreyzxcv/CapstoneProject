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

        return DB::transaction(function () use ($donation, $user, $photo) {
            // Re-read under lock so two simultaneous requests can't both release it.
            $donation = Donation::whereKey($donation->id)->lockForUpdate()->firstOrFail();

            if ($donation->released_at !== null) {
                throw new DomainException('Donation has already been released.');
            }

            $before = $donation->toArray();

            $updates = ['released_at' => now()];
            if ($photo) {
                $updates['release_photo_path'] = $photo->store('documents/donations/release-photos', 'local');
            }

            $donation->update($updates);

            $this->auditLogService->log('donation.released', $donation, $before, $donation->fresh()->toArray(), $user->id);

            // A batch donation covers several assets; check each one, not just the
            // asset of whichever disposal the request came through.
            $assets = $donation->disposals()
                ->where('disposal_type', DisposalType::Donation->value)
                ->with('asset')
                ->get()
                ->pluck('asset')
                ->filter()
                ->unique('id');

            foreach ($assets as $asset) {
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
            }

            return $donation->fresh();
        });
    }
}