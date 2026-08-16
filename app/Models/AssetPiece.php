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
        'disposal_id',
        'disposed_at',
    ];

    protected function casts(): array
    {
        return [
            'disposed_at' => 'datetime',
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