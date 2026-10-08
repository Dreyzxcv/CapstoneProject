<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\BackupService;
use App\Services\NotificationService;
use Illuminate\Console\Command;

class CreateDailyBackup extends Command
{
    protected $signature   = 'backup:run';
    protected $description = 'Create a daily backup of the database and uploaded documents';

    public function handle(BackupService $backupService, NotificationService $notificationService): int
    {
        $this->info('Starting daily backup...');

        $record = $backupService->run();

        if ($record->status === 'success') {
            $this->info("Backup completed: {$record->filename} ({$record->formattedSize()})");
            return self::SUCCESS;
        }

        // Backup failed -- notify every System Admin
        $this->error("Backup failed: {$record->error_message}");

        $admins = User::role('System Admin')->get();

        foreach ($admins as $admin) {
            $notificationService->notify(
                user: $admin,
                title: 'Daily backup failed',
                message: "The scheduled backup that ran on " . now()->format('M d, Y \a\t H:i') .
                         " did not complete successfully. Error: {$record->error_message}",
                status: 'failed',
            );
        }

        return self::FAILURE;
    }
}