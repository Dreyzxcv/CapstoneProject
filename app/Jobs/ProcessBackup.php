<?php

namespace App\Jobs;

use App\Models\BackupRecord;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\BackupService;
use App\Services\NotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ProcessBackup implements ShouldQueue
{
    use Queueable;

    public int $timeout = 1800;
    public int $tries = 1;

    public function __construct(
        public int $recordId,
        public ?int $triggeredBy = null,       // null = automatic (shows as "System")
        public string $trigger = 'manual',     // manual | auto
    ) {}

    public function handle(
        BackupService $backupService,
        NotificationService $notificationService,
        AuditLogService $auditLogService,
    ): void {
        $record = BackupRecord::findOrFail($this->recordId);
        $record = $backupService->execute($record);

        if ($record->status === 'success') {
            $auditLogService->log('backup.completed', $record, null, [
                'filename' => $record->filename,
                'size'     => $record->formattedSize(),
                'trigger'  => $this->trigger,
            ], $this->triggeredBy);

            return;
        }

        $auditLogService->log('backup.failed', $record, null, [
            'filename' => $record->filename,
            'error'    => $record->error_message,
            'trigger'  => $this->trigger,
        ], $this->triggeredBy);

        foreach (User::role('System Admin')->get() as $admin) {
            $notificationService->notify(
                user: $admin,
                title: ucfirst($this->trigger) . ' backup failed',
                message: "A {$this->trigger} backup on " . now()->format('M d, Y \a\t H:i') .
                         " did not complete. Error: {$record->error_message}",
                status: 'failed',
            );
        }
    }
}