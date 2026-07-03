<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Jev extends Model
{
    protected $fillable = [
        'asset_id',
        'jev_number',
        'funding_source_code',
        'funding_source_label',
        'transaction_type',
        'transaction_code',
        'responsibility_center',
        'particulars',
        'document_no',
        'prepared_by_name',
        'approved_by_name',
        'line_items',
        'created_by_accounting_id',
        'uploaded_by_mes_id',
        'uploaded_at',
        'pdf_path',
    ];

    protected function casts(): array
    {
        return [
            'uploaded_at' => 'datetime',
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

    public function uploadedByMes(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_mes_id');
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