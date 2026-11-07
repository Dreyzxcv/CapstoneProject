<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserPermissionOverride extends Model
{
    protected $fillable = ['user_id', 'permission', 'allowed'];

    protected function casts(): array
    {
        return ['allowed' => 'boolean'];
    }
}