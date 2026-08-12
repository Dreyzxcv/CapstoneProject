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

    public function markStored(User $user, Asset $asset): bool
    {
        return $user->can('assets.mark_stored')
            && $asset->current_status === \App\Enums\AssetStatus::PendingCustodyReview
            && $asset->hasAllRequiredDocumentsVerified();
    }

    public function generateQr(User $user, Asset $asset): bool
    {
        return $user->can('assets.generate_qr');
    }
    
    public function updateAap(User $user, Asset $asset): bool
    {
        return $user->can('assets.update_aap');
    }

    public function updateCaseStatus(User $user, Asset $asset): bool
    {
        return $user->can('assets.update_case')
            && $asset->current_status === \App\Enums\AssetStatus::UnderTrial;
    }
}
