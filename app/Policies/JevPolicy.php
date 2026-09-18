<?php

namespace App\Policies;

use App\Models\Asset;
use App\Models\Jev;
use App\Models\User;

class JevPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('jev.view');
    }

    public function create(User $user): bool
    {
        return $user->can('jev.create');
    }

    public function issue(User $user, Asset $asset): bool
    {
        return $user->can('jev.create');
    }

    public function store(User $user, Jev $jev): bool
    {
        return $user->can('jev.create');
    }

    public function upload(User $user, Jev $jev): bool
    {
        return $user->can('jev.upload');
    }
}