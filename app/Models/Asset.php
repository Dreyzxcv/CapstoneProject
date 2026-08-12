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
        'quantity', 'quantity_unit', 'length', 'width', 'height', 'volume_bd_ft', 'volume_cu_m',
        'disposed_quantity', 'disposed_volume_bd_ft', 'disposed_volume_cu_m',
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
            'length' => 'decimal:2', 
            'width' => 'decimal:2',
            'height' => 'decimal:2',
            'volume_bd_ft' => 'decimal:2',
            'volume_cu_m' => 'decimal:4',
            'estimated_value' => 'decimal:2',
            'next_hearing_date' => 'date',
            'disposed_quantity' => 'integer',
            'disposed_volume_bd_ft' => 'decimal:2',
            'disposed_volume_cu_m' => 'decimal:4',
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

    public function disposals(): HasMany
    {
        return $this->hasMany(Disposal::class);
    }

    public function latestDisposal(): HasOne
    {
        return $this->hasOne(Disposal::class)->latestOfMany();
    }

    public function remainingQuantity(): int
    {
        return max(0, ($this->quantity ?? 1) - ($this->disposed_quantity ?? 0));
    }

    public function remainingVolumeBdFt(): ?float
    {
        if ($this->volume_bd_ft === null) {
            return null;
        }

        return max(0, (float) $this->volume_bd_ft - (float) ($this->disposed_volume_bd_ft ?? 0));
    }

    public function isFullyDisposed(): bool
    {
        return $this->remainingQuantity() <= 0;
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

    /**
     * Required upload set per NewFlow.pdf Stage 1: Apprehended intakes need
     * DAO Form / Tally Sheet / AAP; Turned Over intakes follow the separate
     * "STCP Document Ingestion" branch and only need the STCP document.
     */
    public function requiredDocumentTypes(): array
    {
        return match ($this->mode) {
            AssetMode::TurnedOver => [
                \App\Enums\DocumentType::StcpDocument,
            ],
            default => [
                \App\Enums\DocumentType::DaoForm,
                \App\Enums\DocumentType::TallySheet,
                \App\Enums\DocumentType::AapDocument,
            ],
        };
    }

    /**
     * Subset of requiredDocumentTypes() that actually blocks markStored —
     * mirrors requiredDocumentTypes() per mode (see note above).
     */
    public function blockingDocumentTypes(): array
    {
        return match ($this->mode) {
            AssetMode::TurnedOver => [
                \App\Enums\DocumentType::StcpDocument,
            ],
            default => [
                \App\Enums\DocumentType::DaoForm,
                \App\Enums\DocumentType::TallySheet,
            ],
        };
    }

    public function hasAllRequiredDocumentsVerified(): bool
    {
        $required = $this->blockingDocumentTypes();

        if (empty($required)) {
            return true;
        }

        $verifiedTypes = $this->documents()
            ->where('status', \App\Enums\DocumentStatus::Verified->value)
            ->pluck('document_type')
            ->map(fn ($t) => $t instanceof \App\Enums\DocumentType ? $t->value : $t)
            ->unique();

        foreach ($required as $type) {
            if (! $verifiedTypes->contains($type->value)) {
                return false;
            }
        }

        return true;
    }
}