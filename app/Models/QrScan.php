<?php

namespace App\Models;

use App\Enums\AssetStatus;
use App\Models\AssetPiece;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QrScan extends Model
{
    protected $fillable = [
        'asset_id',
        'asset_piece_id',
        'scanned_by',
        'scan_location_note',
        'resulting_status',
        'scanned_at',
    ];

    protected function casts(): array
    {
        return [
            'resulting_status' => AssetStatus::class,
            'scanned_at' => 'datetime',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function assetPiece(): BelongsTo
    {
        return $this->belongsTo(AssetPiece::class);
    }

    public function scannedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'scanned_by');
    }
}
