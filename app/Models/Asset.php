<?php
// app/Models/Asset.php

namespace App\Models;

use App\Enums\AssetMode;
use App\Enums\AssetStatus;
use App\Enums\AssetType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Asset extends Model
{
    protected $hidden = ['qr_code_token'];

    protected $fillable = [
        'incident_id',
        'asset_code',
        'type',
        'species',
        'description',
        'quantity',
        'volume_bd_ft',
        'volume_cu_m',
        'estimated_value',
        'plate_number',
        'municipality_of_origin',
        'location_apprehended',
        'apprehending_agency',
        'mode',
        'has_ongoing_case',
        'has_confiscation_order',
        'case_number',
        'court_branch',
        'next_hearing_date',
        'appeal_deadline',
        'current_status',
        'qr_code_token',
        'metadata',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'type' => AssetType::class,
            'mode' => AssetMode::class,
            'current_status' => AssetStatus::class,
            'has_ongoing_case' => 'boolean',
            'has_confiscation_order' => 'boolean',
            'appeal_deadline' => 'datetime',
            'metadata' => 'array',
            'quantity' => 'integer',
            'volume_bd_ft' => 'decimal:2',
            'volume_cu_m' => 'decimal:4',
            'estimated_value' => 'decimal:2',
            'next_hearing_date' => 'date',
        ];
    }

    public function incident(): BelongsTo
    {
        return $this->belongsTo(Incident::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(AssetCaseStatusHistory::class);
    }

    public function acknowledgementReceipt(): HasOne
    {
        return $this->hasOne(AcknowledgementReceipt::class);
    }

    public function jev(): HasOne
    {
        return $this->hasOne(Jev::class);
    }

    public function disposal(): HasOne
    {
        return $this->hasOne(Disposal::class);
    }

    public function qrScans(): HasMany
    {
        return $this->hasMany(QrScan::class);
    }

    public function documents(): MorphMany
    {
        return $this->morphMany(Document::class, 'attachable');
    }

    public function custodyReceipt(): ?AcknowledgementReceipt
    {
        if ($this->acknowledgementReceipt) {
            return $this->acknowledgementReceipt;
        }

        return $this->incident
            ?->assets()
            ->whereHas('acknowledgementReceipt')
            ->with('acknowledgementReceipt')
            ->first()
            ?->acknowledgementReceipt;
    }
}