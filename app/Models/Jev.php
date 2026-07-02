<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Jev extends Model
{
    protected $fillable = [
        'asset_id',
        'jev_number',
        'created_by_accounting_id',
        'uploaded_by_mes_id',
        'uploaded_at',
        'pdf_path',
    ];

    protected function casts(): array
    {
        return [
            'uploaded_at' => 'datetime',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function createdByAccounting(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_accounting_id');
    }

    public function uploadedByMes(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_mes_id');
    }
}
