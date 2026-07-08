<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Incident extends Model
{
    protected $fillable = [
        'incident_code',
        'date_of_apprehension',
        'place_of_apprehension',
        'area',
        'coordinates',
        'claimant_offender_name',
        'is_abandoned',
        'apprehending_party',
        'date_report_submitted',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'date_of_apprehension' => 'date',
            'date_report_submitted' => 'date',
            'is_abandoned' => 'boolean',
        ];
    }

    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}