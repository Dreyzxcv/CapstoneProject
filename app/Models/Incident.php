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
        'has_claimant',
        'apprehending_party',
        'initial_custodian_name',
        'date_report_submitted',
        'confiscation_order_path',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'date_of_apprehension' => 'date',
            'date_report_submitted' => 'date',
            'has_claimant' => 'boolean',
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

    public function claimants(): HasMany
    {
        return $this->hasMany(IncidentClaimant::class)->orderBy('id');
    }
}