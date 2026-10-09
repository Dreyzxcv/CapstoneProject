<?php

namespace App\Models;

use App\Enums\AssetStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetCaseStatusHistory extends Model
{
    protected $table = 'asset_case_status_history';

    protected $fillable = [
        'asset_id',
        'status',
        'event_type',
        'changed_by',
        'notes',
        'changed_fields',
        'changed_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => AssetStatus::class,
            'changed_fields' => 'array',
            'changed_at' => 'datetime',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
