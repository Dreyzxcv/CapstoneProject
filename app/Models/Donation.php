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
        'municipality',
        'barangay',
        'street',
        'deed_of_donation_path',
        'release_photo_path',
        'waybill_pdf_path',
        'released_at',
    ];

    protected function casts(): array
    {
        return [
            'organization_type' => \App\Enums\DonationOrganizationType::class,
            'municipality' => \App\Enums\Municipality::class,
            'released_at' => 'datetime',
        ];
    }

    public function disposal(): BelongsTo
    {
        return $this->belongsTo(Disposal::class);
    }

    public function fullAddress(): string
    {
        return collect([
            $this->street,
            $this->barangay,
            $this->municipality?->value,
            'Catanduanes',
        ])->filter()->implode(', ');
    }
}