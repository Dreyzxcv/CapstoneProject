<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IncidentClaimant extends Model
{
    protected $fillable = [
        'incident_id', 'name', 'address', 'contact_number', 'id_type', 'id_number',
    ];

    public function incident(): BelongsTo
    {
        return $this->belongsTo(Incident::class);
    }
}