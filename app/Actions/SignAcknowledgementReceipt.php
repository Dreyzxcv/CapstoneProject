<?php

namespace App\Actions;

use App\Enums\AssetStatus;
use App\Models\Asset;
use App\Models\User;
use App\Services\AssetLifecycleService;
use DomainException;

class SignAcknowledgementReceipt
{
    public function __construct(
        protected AssetLifecycleService $lifecycleService,
    ) {}

    public function execute(Asset $asset, User $user): Asset
    {
        $receipt = $asset->custodyReceipt();

        if (! $receipt) {
            throw new DomainException('Acknowledgement receipt not found.');
        }

        if ($receipt->signed_at) {
            throw new DomainException('Receipt already signed.');
        }

        if ($asset->current_status !== AssetStatus::PendingCustodyReview) {
            throw new DomainException('Asset is not pending custody review.');
        }

        $receipt->update([
            'signed_by_custodian_id' => $user->id,
            'signed_at' => now(),
        ]);

        return $this->lifecycleService->transition(
            $asset->fresh(),
            AssetStatus::ReceiptSigned,
            $user,
            'Acknowledgement receipt signed by Property Custodian.',
            'receipt.signed',
        );
    }
}
