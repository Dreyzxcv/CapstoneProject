<?php

namespace App\Policies;

use App\Models\Document;
use App\Models\User;

class DocumentPolicy
{
    public function verify(User $user, Document $document): bool
    {
        return $user->can('documents.verify');
    }
}