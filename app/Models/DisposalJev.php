<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DisposalJev extends Model
{
    protected $fillable = [
        'disposal_id',
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
        'issued_by_accounting_id',
        'pdf_path',
    ];

    protected function casts(): array
    {
        return [
            'line_items' => 'array',
        ];
    }

    public function disposal(): BelongsTo
    {
        return $this->belongsTo(Disposal::class);
    }

    public function issuedByAccounting(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by_accounting_id');
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