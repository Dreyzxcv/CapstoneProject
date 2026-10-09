<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessBackup;
use App\Models\BackupRecord;
use App\Services\AuditLogService;
use App\Services\BackupService;
use Illuminate\Validation\ValidationException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use App\Models\BackupSetting;
use Illuminate\Support\Facades\Storage;

class BackupController extends Controller
{
    public static function latestStatus(): ?array
    {
        $latest = BackupRecord::orderByDesc('created_at')->first();

        if (! $latest) {
            return null;
        }

        $unfinished = $latest->completed_at === null;
        $running    = $unfinished && $latest->created_at->gt(now()->subMinutes(30));
        $stale      = $unfinished && ! $running;

        return [
            'status'        => $running ? 'running' : $latest->status,
            'progress'      => $latest->progress ?? 0,
            'stage'         => $latest->stage,
            'filename'      => $latest->filename,
            'location' => $latest->absolutePath(),
            'size'          => $latest->formattedSize(),
            'completed_at'  => $latest->completed_at?->toIso8601String(),
            'error_message' => $latest->error_message
                ?? ($stale ? 'Backup did not finish. Make sure the queue worker is running.' : null),
        ];
    }

    public function run(Request $request, BackupService $backupService, AuditLogService $auditLogService): RedirectResponse
    {
        $this->authorize('backup.run');

        $current = self::latestStatus();
        if (($current['status'] ?? null) === 'running') {
            return back()->with('error', 'A backup is already running.');
        }

        $record = $backupService->start();

        $auditLogService->log('backup.started', $record, null, [
            'filename' => $record->filename,
            'trigger'  => 'manual',
        ]);

        ProcessBackup::dispatch($record->id, $request->user()->id, 'manual');

        return back()->with('success', 'Backup started. This may take a few minutes.');
    }

    public function updateSettings(Request $request, AuditLogService $auditLogService): RedirectResponse
    {
        $this->authorize('backup.run');

        $data = $request->validate([
            'auto_enabled'   => ['required', 'boolean'],
            'frequency'      => ['required', 'in:daily,weekly'],
            'time'           => ['required', 'date_format:H:i'],
            'day_of_week'    => ['required', 'integer', 'between:0,6'],
            'retention_days' => ['required', 'integer', 'between:1,365'],
            'backup_path'    => ['nullable', 'string', 'max:500'],
        ]);

        $data['backup_path'] = $this->checkBackupPath($data['backup_path'] ?? null);

        $settings = BackupSetting::current();
        $settings->fill($data);

        $old = [];
        $new = [];
        foreach ($settings->getDirty() as $key => $value) {
            $old[$key] = $settings->getOriginal($key);
            $new[$key] = $value;
        }

        $settings->save();

        if ($new !== []) {
            $auditLogService->log('backup.settings_updated', $settings, $old, $new);
        }

        return back()->with('success', 'Backup settings saved.');
    }

    private function checkBackupPath(?string $path): ?string
    {
        $path = $path === null ? '' : rtrim(trim($path), '\\/');

        if ($path === '') {
            return null; 
        }

        $fail = fn (string $message) => throw ValidationException::withMessages(['backup_path' => $message]);

        $isAbsolute = preg_match('/^[A-Za-z]:[\\\\\/]/', $path) === 1
            || str_starts_with($path, '\\\\')
            || str_starts_with($path, '/');

        if (! $isAbsolute) {
            $fail('Use a full path, for example D:\Backups or \\\\SERVER\Share\Backups.');
        }

        if (preg_match('#(^|[\\\\/])\.\.([\\\\/]|$)#', $path)) {
            $fail('The folder path cannot contain "..".');
        }
        
        $norm = fn (string $p) => strtolower(str_replace('/', '\\', rtrim($p, '\\/'))) . '\\';
        foreach ([public_path(), storage_path('app/public')] as $blocked) {
            if (str_starts_with($norm($path), $norm($blocked))) {
                $fail('This folder is publicly accessible. Choose a folder outside the website.');
            }
        }

        if (! is_dir($path) && ! @mkdir($path, 0750, true)) {
            $fail('Cannot create this folder. Check that the drive exists and the server has permission.');
        }

        $probe = $path . DIRECTORY_SEPARATOR . '.write-test-' . uniqid();
        if (@file_put_contents($probe, 'ok') === false) {
            $fail('The server cannot write to this folder. Check permissions.');
        }
        @unlink($probe);

        return $path;
    }
}