<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Jev extends Model
{
    protected $fillable = [
        'asset_id',
        'jev_number',
        'jev_date',
        'particulars',
        'amount',
        'line_items',
        'created_by_accounting_id',
        'pdf_path',
    ];

    protected function casts(): array
    {
        return [
            'jev_date'   => 'date',
            'amount'     => 'decimal:2',
            'line_items' => 'array',
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

    public function totalDebit(): float
    {
        return collect($this->line_items ?? [])->sum(fn ($line) => (float) ($line['debit'] ?? 0));
    }

    public function totalCredit(): float
    {
        return collect($this->line_items ?? [])->sum(fn ($line) => (float) ($line['credit'] ?? 0));
    }
}