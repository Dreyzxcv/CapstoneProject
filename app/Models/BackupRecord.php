<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BackupRecord extends Model
{
    protected $fillable = [
        'filename',
        'path',
        'size_bytes',
        'status',
        'progress',
        'stage',
        'error_message',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'size_bytes'   => 'integer',
            'completed_at' => 'datetime',
        ];
    }

    public function scopeSuccessful($query)
    {
        return $query->where('status', 'success');
    }

    public function formattedSize(): string
    {
        $bytes = $this->size_bytes ?? 0;

        if ($bytes >= 1_073_741_824) {
            return number_format($bytes / 1_073_741_824, 2) . ' GB';
        }

        if ($bytes >= 1_048_576) {
            return number_format($bytes / 1_048_576, 2) . ' MB';
        }

        return number_format($bytes / 1_024, 2) . ' KB';
    }
}