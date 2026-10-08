<?php

namespace App\Console\Commands;

use App\Http\Controllers\BackupController;
use App\Services\AuditLogService;
use App\Jobs\ProcessBackup;
use App\Models\BackupSetting;
use App\Services\BackupService;
use Illuminate\Console\Command;

class RunAutoBackup extends Command
{
    protected $signature = 'backup:auto';
    protected $description = 'Run the scheduled backup if due, and delete expired backups.';

    public function handle(BackupService $service, AuditLogService $auditLogService): int
    {
        $service->pruneOldBackups();

        $settings = BackupSetting::current();

        if (! $settings->isDue()) {
            return self::SUCCESS;
        }

        if ((BackupController::latestStatus()['status'] ?? null) === 'running') {
            return self::SUCCESS;
        }

        $settings->update(['last_auto_run_at' => now()]);

        $record = $service->start();

        $auditLogService->log('backup.started', $record, null, [
            'filename' => $record->filename,
            'trigger'  => 'auto',
        ]);

        ProcessBackup::dispatch($record->id, null, 'auto');

        return self::SUCCESS;
    }
}