<?php

namespace App\Actions;

use App\Enums\AssetStatus;
use App\Models\Asset;
use App\Models\User;
use App\Services\AssetLifecycleService;
use DomainException;

class ResolveTrial
{
    public function __construct(
        protected AssetLifecycleService $lifecycleService,
    ) {}

    public function execute(Asset $asset, User $user, ?string $notes = null): Asset
    {
        if ($asset->current_status !== AssetStatus::UnderTrial) {
            throw new DomainException('Asset is not currently under trial.');
        }

        return $this->lifecycleService->transition(
            $asset,
            AssetStatus::ClearedForAccounting,
            $user,
            $notes ?? 'Case resolved by the court/regional office — cleared for accounting.',
            'asset.case_resolved',
        );
    }
}