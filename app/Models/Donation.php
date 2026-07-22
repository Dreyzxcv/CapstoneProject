<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Donation extends Model
{
    protected $fillable = [
        'disposal_id',
        'requester_name',
        'organization_type',
        'organization_type_other',
        'agency_name',
        'deed_of_donation_path',
        'release_photo_path',
        'released_at',
    ];

    protected function casts(): array
    {
        return [
            'organization_type' => \App\Enums\DonationOrganizationType::class,
            'released_at' => 'datetime',
        ];
    }


    public function disposal(): BelongsTo
    {
        return $this->belongsTo(Disposal::class);
    }
}
