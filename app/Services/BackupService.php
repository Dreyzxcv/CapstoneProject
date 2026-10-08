<?php

namespace App\Services;

use App\Models\BackupRecord;
use App\Services\AuditLogService;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;
use App\Models\BackupSetting;
use Throwable;
use ZipArchive;

class BackupService
{
    public const BACKUP_FOLDER = 'backups';

    /** Number of successful daily backups to keep. */
    public const RETENTION_LIMIT = 30;

    public function __construct(protected AuditLogService $auditLogService) {}

    /**
     * Create the record for a new backup (does not run it yet).
     */
    public function start(): BackupRecord
    {
        $timestamp = now()->format('Y-m-d_His');
        $filename  = "backup_{$timestamp}.zip";

        return BackupRecord::create([
            'filename' => $filename,
            'path'     => self::BACKUP_FOLDER . '/' . $filename,
            'status'   => 'failed',   // flips to success at the end
            'progress' => 0,
            'stage'    => 'Queued',
        ]);
    }

    /**
     * Synchronous full backup. Used by the 02:00 scheduler.
     */
    public function run(): BackupRecord
    {
        return $this->execute($this->start());
    }

    /**
     * Do the actual work for an existing record.
     * Never throws -- failures are captured in the record's error_message.
     */
    public function execute(BackupRecord $record): BackupRecord
    {
        set_time_limit(0);

        try {
            $this->ensureBackupDirectory();

            $zipPath = $this->buildArchive($record);

            $record->update([
                'status'       => 'success',
                'size_bytes'   => filesize($zipPath),
                'progress'     => 100,
                'stage'        => 'Done',
                'completed_at' => now(),
            ]);

            $this->pruneOldBackups();
        } catch (Throwable $e) {
            $record->update([
                'status'        => 'failed',
                'error_message' => $e->getMessage(),
                'completed_at'  => now(),
            ]);
        }

        return $record->refresh();
    }

    public function deleteFile(BackupRecord $record): void
    {
        $absolutePath = Storage::disk('local')->path($record->path);

        if (file_exists($absolutePath)) {
            @unlink($absolutePath);
        }
    }

    // -----------------------------------------------------------------------
    // Internals
    // -----------------------------------------------------------------------

    protected function ensureBackupDirectory(): void
    {
        $dir = Storage::disk('local')->path(self::BACKUP_FOLDER);

        if (! File::isDirectory($dir)) {
            File::makeDirectory($dir, 0750, true);
        }
    }

    protected function buildArchive(BackupRecord $record): string
    {
        $timestamp = $record->created_at->format('Y-m-d_His');
        $zipPath   = Storage::disk('local')->path($record->path);

        $zip = new ZipArchive();
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new \RuntimeException("Cannot create ZIP archive at {$zipPath}");
        }

        $record->update(['progress' => 5, 'stage' => 'Dumping database']);
        $dbDumpPath = $this->dumpDatabase($timestamp);
        $zip->addFile($dbDumpPath, 'database/' . basename($dbDumpPath));

        $record->update(['progress' => 20, 'stage' => 'Collecting documents']);
        $this->addDirectoryToZip(
            $zip,
            Storage::disk('local')->path('documents'),
            'documents'
        );

        // The real work happens inside close(), so report progress from here.
        $record->update(['progress' => 25, 'stage' => 'Writing archive']);
        $zip->registerProgressCallback(0.02, function (float $ratio) use ($record) {
            $record->update(['progress' => 25 + (int) round($ratio * 74)]);
        });

        $zip->close();

        @unlink($dbDumpPath);

        return $zipPath;
    }

    /**
     * Supports SQLite (copy), MySQL (mysqldump) and PostgreSQL (pg_dump).
     */
    protected function dumpDatabase(string $timestamp): string
    {
        $connection = config('database.default');
        $driver     = config("database.connections.{$connection}.driver");
        $tmpDir     = storage_path('app/dompdf-tmp');

        if (! File::isDirectory($tmpDir)) {
            File::makeDirectory($tmpDir, 0750, true);
        }

        return match ($driver) {
            'sqlite' => $this->dumpSqlite($connection, $tmpDir, $timestamp),
            'mysql'  => $this->dumpMysql($connection, $tmpDir, $timestamp),
            'pgsql'  => $this->dumpPostgres($connection, $tmpDir, $timestamp),
            default  => throw new \RuntimeException("Unsupported DB driver for backup: {$driver}"),
        };
    }

    protected function dumpSqlite(string $connection, string $tmpDir, string $timestamp): string
    {
        $dbPath   = config("database.connections.{$connection}.database");
        $dumpPath = "{$tmpDir}/db_{$timestamp}.sqlite";

        if (! copy($dbPath, $dumpPath)) {
            throw new \RuntimeException("Failed to copy SQLite database from {$dbPath}");
        }

        return $dumpPath;
    }

    protected function dumpMysql(string $connection, string $tmpDir, string $timestamp): string
    {
        $cfg      = config("database.connections.{$connection}");
        $dumpPath = "{$tmpDir}/db_{$timestamp}.sql";

        $host     = escapeshellarg($cfg['host'] ?? '127.0.0.1');
        $port     = escapeshellarg($cfg['port'] ?? '3306');
        $database = escapeshellarg($cfg['database']);
        $username = escapeshellarg($cfg['username']);
        $password = $cfg['password'] ?? '';

        $optFile = "{$tmpDir}/my_{$timestamp}.cnf";
        File::put($optFile, "[client]\npassword=" . str_replace('"', '\\"', $password) . "\n");
        chmod($optFile, 0600);

        $cmd = sprintf(
            'mysqldump --defaults-extra-file=%s -h %s -P %s -u %s %s 2>&1',
            escapeshellarg($optFile),
            $host,
            $port,
            $username,
            $database
        );

        $output   = [];
        $exitCode = 0;
        exec($cmd, $output, $exitCode);

        @unlink($optFile);

        if ($exitCode !== 0) {
            throw new \RuntimeException('mysqldump failed: ' . implode("\n", $output));
        }

        File::put($dumpPath, implode("\n", $output));

        return $dumpPath;
    }

    protected function dumpPostgres(string $connection, string $tmpDir, string $timestamp): string
    {
        $cfg      = config("database.connections.{$connection}");
        $dumpPath = "{$tmpDir}/db_{$timestamp}.sql";
        $pgDump   = config('database.pg_dump_path', 'pg_dump');

        $process = new Process(
            [
                $pgDump,
                '--host=' . ($cfg['host'] ?? '127.0.0.1'),
                '--port=' . ($cfg['port'] ?? '5432'),
                '--username=' . $cfg['username'],
                '--no-password',
                '--format=plain',
                '--no-owner',
                '--no-acl',
                '--file=' . $dumpPath,
                $cfg['database'],
            ],
            null,
            ['PGPASSWORD' => (string) ($cfg['password'] ?? '')],
            null,
            300
        );

        $process->run();

        if (! $process->isSuccessful()) {
            @unlink($dumpPath);
            throw new \RuntimeException(
                'pg_dump failed: ' . trim($process->getErrorOutput() ?: $process->getOutput())
            );
        }

        return $dumpPath;
    }

    protected function addDirectoryToZip(ZipArchive $zip, string $dirPath, string $zipPrefix): void
    {
        if (! File::isDirectory($dirPath)) {
            return;
        }

        $files = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dirPath, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::LEAVES_ONLY
        );

        foreach ($files as $file) {
            if (! $file->isFile()) {
                continue;
            }

            $absolutePath = $file->getRealPath();
            $relativePath = $zipPrefix . '/' . ltrim(
                str_replace($dirPath, '', $absolutePath),
                DIRECTORY_SEPARATOR
            );

            $zip->addFile($absolutePath, $relativePath);
            // PDFs/images are already compressed; storing is much faster.
            $zip->setCompressionName($relativePath, ZipArchive::CM_STORE);
        }
    }

    public function pruneOldBackups(): void
    {
        $days     = BackupSetting::current()->retention_days;
        $latestId = BackupRecord::successful()->orderByDesc('created_at')->value('id');

        $expired = BackupRecord::successful()
            ->where('created_at', '<', now()->subDays($days))
            ->when($latestId, fn ($q) => $q->where('id', '!=', $latestId))
            ->get();

        foreach ($expired as $old) {
            $this->auditLogService->log(
                'backup.deleted',
                $old,
                ['filename' => $old->filename, 'size' => $old->formattedSize()],
                ['reason' => "Older than {$days} days (retention)"],
            );

            $this->deleteFile($old);
            $old->delete();
        }
    }
}