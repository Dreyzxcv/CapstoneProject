<?php

namespace App\Policies;

use App\Models\Disposal;
use App\Models\User;

class DisposalPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('disposals.view');
    }

    public function create(User $user): bool
    {
        return $user->can('disposals.process');
    }

    public function view(User $user, Disposal $disposal): bool
    {
        return $user->can('disposals.view');
    }
}
