<?php

namespace App\Models;

use App\Enums\DisposalType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Disposal extends Model
{
    protected $fillable = [
        'asset_id',
        'donation_batch_id',
        'disposal_type',
        'quantity',
        'volume_bd_ft',
        'details',
        'report_pdf_path',
        'processed_by',
        'processed_at',
    ];

    protected function casts(): array
    {
        return [
            'disposal_type' => DisposalType::class,
            'quantity' => 'integer',
            'volume_bd_ft' => 'decimal:2',
            'details' => 'array',
            'processed_at' => 'datetime',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function processedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by');
    }

    public function donation(): HasOne
    {
        return $this->hasOne(Donation::class);
    }
    
    public function disposalJev(): HasOne
    {
        return $this->hasOne(DisposalJev::class);
    }

    public function icsRecord(): HasOne
    {
        return $this->hasOne(IcsRecord::class);
    }

    public function parRecord(): HasOne
    {
        return $this->hasOne(ParRecord::class);
    }

    public function batchSiblings()
    {
        if (! $this->donation_batch_id) {
            return self::whereRaw('1 = 0');
        }

        return self::where('donation_batch_id', $this->donation_batch_id)
            ->where('id', '!=', $this->id);
    }
}