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
            throw new DomainException('Asset must be pending custody review before it can be stored.');
        }

        if (! $asset->hasAllRequiredDocumentsVerified()) {
            throw new DomainException('All required documents must be verified before marking as stored.');
        }

        if (! $asset->acknowledgementReceipt) {
            $this->createAsset->issueReceiptFor($asset, $user);
        }

        $asset = $this->lifecycleService->transition(
            $asset->fresh(),
            AssetStatus::Stored,
            $user,
            'Documents verified by Property Custodian; asset tagged, placed in storage, and acknowledgement receipt generated.',
            'asset.stored',
        );

        return $this->lifecycleService->resolveCaseBranch($asset->fresh(), $user);
    }
}