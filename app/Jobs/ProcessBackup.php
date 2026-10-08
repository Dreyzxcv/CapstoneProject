<?php

namespace App\Jobs;

use App\Models\BackupRecord;
use App\Models\User;
use App\Services\BackupService;
use App\Services\NotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ProcessBackup implements ShouldQueue
{
    use Queueable;

    public int $timeout = 1800;
    public int $tries = 1;

    public function __construct(public int $recordId) {}

    public function handle(BackupService $backupService, NotificationService $notificationService): void
    {
        $record = BackupRecord::findOrFail($this->recordId);
        $record = $backupService->execute($record);

        if ($record->status === 'failed') {
            foreach (User::role('System Admin')->get() as $admin) {
                $notificationService->notify(
                    user: $admin,
                    title: 'Manual backup failed',
                    message: "A manual backup triggered on " . now()->format('M d, Y \a\t H:i') .
                             " did not complete. Error: {$record->error_message}",
                    status: 'failed',
                );
            }
        }
    }
}