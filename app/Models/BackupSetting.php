<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class BackupSetting extends Model
{
    protected $fillable = [
        'auto_enabled', 'frequency', 'time', 'day_of_week',
        'retention_days', 'last_auto_run_at', 'backup_path',
    ];

    protected function casts(): array
    {
        return [
            'auto_enabled'     => 'boolean',
            'day_of_week'      => 'integer',
            'retention_days'   => 'integer',
            'last_auto_run_at' => 'datetime',
        ];
    }

    /** The single settings row (created with defaults if missing). */
    public static function current(): self
    {
        return static::firstOrCreate([], [
            'auto_enabled'   => true,
            'frequency'      => 'daily',
            'time'           => '02:00',
            'day_of_week'    => 0,
            'retention_days' => 30,
        ]);
    }

    public function isDue(): bool
    {
        if (! $this->auto_enabled) {
            return false;
        }

        [$h, $m]   = array_map('intval', explode(':', $this->time));
        $scheduled = now()->setTime($h, $m, 0);

        if (now()->lt($scheduled)) {
            return false;
        }

        if ($this->frequency === 'weekly' && now()->dayOfWeek !== $this->day_of_week) {
            return false;
        }

        // Already ran for today's slot
        return ! ($this->last_auto_run_at && $this->last_auto_run_at->gte($scheduled));
    }

    public function nextRunAt(): ?Carbon
    {
        if (! $this->auto_enabled) {
            return null;
        }

        [$h, $m] = array_map('intval', explode(':', $this->time));

        for ($i = 0; $i <= 7; $i++) {
            $candidate = now()->startOfDay()->addDays($i)->setTime($h, $m, 0);

            if ($candidate->gt(now())
                && ($this->frequency === 'daily' || $candidate->dayOfWeek === $this->day_of_week)) {
                return $candidate;
            }
        }

        return null;
    }

    public function directory(): string
    {
        return $this->backup_path
            ? rtrim($this->backup_path, '\\/')
            : Storage::disk('local')->path('backups');
    }
}