<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetPiece extends Model
{
    protected $fillable = [
        'asset_id',
        'piece_number',
        'qr_code_token',
        // Per-piece measurement fields (encoded 1-by-1 by MES)
        'species',
        'description',
        'length',
        'width',
        'height',
        'volume_bd_ft',
        'volume_cu_m',
        'estimated_value',
        'plate_number',
        // Disposal tracking (existing)
        'disposal_id',
        'disposed_at',
    ];

    protected function casts(): array
    {
        return [
            'length'          => 'float',
            'width'           => 'float',
            'height'          => 'float',
            'volume_bd_ft'    => 'float',
            'volume_cu_m'     => 'float',
            'estimated_value' => 'float',
            'disposed_at'     => 'datetime',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function disposal(): BelongsTo
    {
        return $this->belongsTo(Disposal::class);
    }

    public function isDisposed(): bool
    {
        return $this->disposed_at !== null;
    }
}