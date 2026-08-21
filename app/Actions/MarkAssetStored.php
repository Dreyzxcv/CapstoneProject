<?php

namespace App\Actions;

use App\Enums\AssetStatus;
use App\Models\Asset;
use App\Models\User;
use App\Services\AssetLifecycleService;
use DomainException;

class MarkAssetStored
{
    public function __construct(
        protected AssetLifecycleService $lifecycleService,
        protected CreateAsset $createAsset,
    ) {}

    public function execute(Asset $asset, User $user): Asset
    {
        if ($asset->current_status !== AssetStatus::PendingCustodyReview) {
            throw new DomainException('Asset must be pending custody review before it can be tagged.');
        }

        if (! $asset->hasAllRequiredDocumentsVerified()) {
            throw new DomainException('All required documents must be verified before tagging the asset.');
        }

        if (! $asset->acknowledgementReceipt) {
            $this->createAsset->issueReceiptFor($asset, $user);
        }

        return $this->lifecycleService->resolveCaseBranch($asset->fresh(), $user);
    }
}