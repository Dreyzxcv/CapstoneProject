<?php

namespace App\Actions;

use App\Models\Disposal;
use App\Models\Donation;
use App\Models\User;
use App\Services\AuditLogService;
use DomainException;
use Illuminate\Support\Facades\DB;

class ReleaseDonation
{
    public function __construct(
        protected AuditLogService $auditLogService,
    ) {}

    public function execute(Disposal $disposal, User $user): Donation
    {
        $donation = $disposal->donation;

        if (! $donation) {
            throw new DomainException('This disposal has no associated donation.');
        }

        if ($donation->released_at !== null) {
            throw new DomainException('Donation has already been released.');
        }

        return DB::transaction(function () use ($donation, $user) {
            $before = $donation->toArray();

            $donation->update(['released_at' => now()]);

            $this->auditLogService->log('donation.released', $donation, $before, $donation->fresh()->toArray(), $user->id);

            return $donation->fresh();
        });
    }
}
