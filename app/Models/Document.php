<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Document extends Model
{
    protected $fillable = [
        'attachable_type',
        'attachable_id',
        'document_type',
        'file_path',
        'original_name',
        'mime_type',
        'status',
        'remarks',
        'uploaded_by',
        'uploaded_at',
        'verified_by',
        'verified_at',
    ];

    protected function casts(): array
    {
        return [
            'document_type' => \App\Enums\DocumentType::class,
            'status' => \App\Enums\DocumentStatus::class,
            'uploaded_at' => 'datetime',
            'verified_at' => 'datetime',
        ];
    }

    public function attachable(): MorphTo
    {
        return $this->morphTo();
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }
}
