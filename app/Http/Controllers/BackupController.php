<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessBackup;
use App\Models\BackupRecord;
use App\Services\AuditLogService;
use App\Services\BackupService;
use Illuminate\Validation\ValidationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use App\Models\BackupSetting;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class BackupController extends Controller
{
    private const STALE_MESSAGE = 'Backup did not finish. Make sure the queue worker is running.';

    /**
     * running | stale | success | failed
     * Same rule as before: an unfinished record is "running" for 30 minutes, then "stale".
     */
    private static function stateOf(BackupRecord $record): string
    {
        if ($record->completed_at === null) {
            return $record->created_at->gt(now()->subMinutes(30)) ? 'running' : 'stale';
        }

        return $record->status === 'success' ? 'success' : 'failed';
    }

    public static function latestStatus(): ?array
    {
        $latest = BackupRecord::orderByDesc('created_at')->first();

        if (! $latest) {
            return null;
        }

        $state = self::stateOf($latest);

        return [
            // `status` keeps its old meaning (running / success / failed) for existing callers.
            'status'        => $state === 'running' ? 'running' : $latest->status,
            'state'         => $state,
            'progress'      => $latest->progress ?? 0,
            'stage'         => $latest->stage,
            'filename'      => $latest->filename,
            'location'      => $latest->absolutePath(),
            'size'          => $latest->formattedSize(),
            'started_at'    => $latest->created_at->toIso8601String(),
            'completed_at'  => $latest->completed_at?->toIso8601String(),
            'error_message' => $latest->error_message
                ?? ($state === 'stale' ? self::STALE_MESSAGE : null),
        ];
    }

    /** Most recent successful backup, or null. */
    public static function lastSuccess(): ?array
    {
        $record = BackupRecord::successful()->orderByDesc('created_at')->first();

        if (! $record) {
            return null;
        }

        return [
            'filename'     => $record->filename,
            'location'     => $record->absolutePath(),
            'size'         => $record->formattedSize(),
            'completed_at' => $record->completed_at?->toIso8601String(),
            'age'          => $record->completed_at?->diffForHumans(),
        ];
    }

    /**
     * Recent backup attempts, newest first.
     * Trigger (manual/auto) is intentionally not included: backup_records has no trigger column.
     */
    public static function history(int $limit = 15): array
    {
        return BackupRecord::orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(function (BackupRecord $r) {
                $state = self::stateOf($r);

                return [
                    'id'            => $r->id,
                    'state'         => $state,
                    'filename'      => $r->filename,
                    'destination'   => dirname($r->absolutePath()),
                    'size'          => $state === 'success' ? $r->formattedSize() : null,
                    'started_at'    => $r->created_at->toIso8601String(),
                    'completed_at'  => $r->completed_at?->toIso8601String(),
                    'error_message' => $r->error_message
                        ?? ($state === 'stale' ? self::STALE_MESSAGE : null),
                ];
            })
            ->all();
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

    /**
     * Test a backup folder without saving it. Uses the same checks as saving settings.
     * An empty value tests the default folder. The folder is created if missing
     * (same as saving); the temporary test file is always removed.
     */
    public function testPath(Request $request): JsonResponse
    {
        $this->authorize('backup.run');

        $data = $request->validate([
            'backup_path' => ['nullable', 'string', 'max:500'],
        ]);

        $path = $this->checkBackupPath($data['backup_path'] ?? null, true);

        return response()->json([
            'ok'      => true,
            'path'    => $path,
            'message' => 'The server can write to this folder.',
        ]);
    }

    /** Shows docs/BACKUP_PLAN.md (setup + restore instructions) inside the app. Read-only. */
    public function guide(): InertiaResponse
    {
        $this->authorize('backup.run');

        $file = base_path('docs/BACKUP_PLAN.md');

        return Inertia::render('Settings/Admin/Backup/Guide', [
            'content' => is_file($file) ? file_get_contents($file) : null,
        ]);
    }

    private function checkBackupPath(?string $path, bool $useDefaultWhenEmpty = false): ?string
    {
        $path = $path === null ? '' : rtrim(trim($path), '\\/');

        if ($path === '') {
            if (! $useDefaultWhenEmpty) {
                return null;
            }

            $path = rtrim(Storage::disk('local')->path('backups'), '\\/');
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
        try {
            if (@file_put_contents($probe, 'ok') === false) {
                $fail('The server cannot write to this folder. Check permissions.');
            }
        } finally {
            if (is_file($probe)) {
                @unlink($probe);
            }
        }

        return $path;
    }
}