<?php

namespace App\Policies;

use App\Models\Asset;
use App\Models\User;

class AssetPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('assets.view');
    }

    public function view(User $user, Asset $asset): bool
    {
        return $user->can('assets.view');
    }

    public function create(User $user): bool
    {
        return $user->can('assets.create');
    }

    public function update(User $user, Asset $asset): bool
    {
        return $user->can('assets.update');
    }

    public function markStored(User $user, Asset $asset): bool
    {
        if ($asset->hasAapDocument() && ! $asset->hasAapDocumentVerified()) {
            return false;
        }

        // Custody review must be approved before the custodian can tag the asset.
        if ($asset->custody_review_status !== 'approved') {
            return false;
        }

        return $user->can('assets.mark_stored')
            && in_array($asset->current_status, [
                \App\Enums\AssetStatus::PendingCustodyReview,
                \App\Enums\AssetStatus::ReceiptSigned,
            ])
            && $asset->hasAllRequiredDocumentsVerified();
    }

    public function submitForCustodyReview(User $user, Asset $asset): bool
    {
        if (! $user->can('assets.submit_custody_review')) {
            return false;
        }

        if ($asset->hasAapDocument() && blank($asset->aap_number)) {
            return false;
        }

        return true;
    }

    public function resolveCustodyReview(User $user, Asset $asset): bool
    {
        // Only custodians
        return $user->hasRole('Property Custodian');
    }

    public function generateQr(User $user, Asset $asset): bool
    {
        return $user->can('assets.generate_qr')
            && $asset->hasAapDocument();
    }
    
    public function updateAap(User $user, Asset $asset): bool
    {
        return $user->can('assets.update_aap')
            && $asset->hasAapDocument();
    }

    public function updateCaseStatus(User $user, Asset $asset): bool
    {
        return $user->can('assets.update_case')
            && $asset->current_status === \App\Enums\AssetStatus::UnderTrial;
    }

    public function submitAapForReview(User $user, Asset $asset): bool
    {
        return $user->can('assets.submit_custody_review')
            && $asset->hasAapDocument()
            && ! blank($asset->aap_number)
            && ! $asset->aap_review_requested;
    }
}
