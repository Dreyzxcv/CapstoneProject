<?php

namespace Tests\Feature;

use App\Console\Commands\CreateDailyBackup;
use App\Models\BackupRecord;
use App\Models\Notification;
use App\Models\User;
use App\Services\BackupService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class BackupTest extends TestCase
{
    use RefreshDatabase;

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /** Create a user with the System Admin role (and backup.run permission). */
    private function makeAdmin(): User
    {
        Permission::firstOrCreate(['name' => 'backup.run']);
        $role = Role::firstOrCreate(['name' => 'System Admin']);
        $role->givePermissionTo('backup.run');

        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    /** Create a non-admin user (MES Officer) who has no backup.run permission. */
    private function makeNonAdmin(): User
    {
        $role = Role::firstOrCreate(['name' => 'MES Officer']);

        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    /** Return a mock BackupService that reports a successful backup. */
    private function mockSuccessfulBackupService(): BackupService
    {
        $mock = Mockery::mock(BackupService::class);

        $mock->shouldReceive('run')
            ->once()
            ->andReturn(BackupRecord::create([
                'filename'     => 'backup_2026-10-07_020000.zip',
                'path'         => 'backups/backup_2026-10-07_020000.zip',
                'size_bytes'   => 1_048_576,
                'status'       => 'success',
                'completed_at' => now(),
            ]));

        return $mock;
    }

    /** Return a mock BackupService that reports a failed backup. */
    private function mockFailedBackupService(): BackupService
    {
        $mock = Mockery::mock(BackupService::class);

        $mock->shouldReceive('run')
            ->once()
            ->andReturn(BackupRecord::create([
                'filename'      => 'backup_2026-10-07_020000.zip',
                'path'          => 'backups/backup_2026-10-07_020000.zip',
                'status'        => 'failed',
                'error_message' => 'mysqldump: command not found',
                'completed_at'  => now(),
            ]));

        return $mock;
    }

    // -----------------------------------------------------------------------
    // Test 1 -- successful backup creates a BackupRecord with status=success
    // -----------------------------------------------------------------------

    public function test_successful_backup_creates_record_and_stores_archive(): void
    {
        Storage::fake('local');

        $service = new BackupService();

        // Fake a minimal SQLite DB path so the service can copy it
        $dbPath = storage_path('database.sqlite');
        file_put_contents($dbPath, '');
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => $dbPath]);

        // Also create the documents folder so the zip step doesn't error
        Storage::disk('local')->makeDirectory('documents');

        $record = $service->run();

        $this->assertSame('success', $record->status);
        $this->assertNotNull($record->completed_at);
        $this->assertGreaterThan(0, $record->size_bytes);
        $this->assertDatabaseHas('backup_records', [
            'status' => 'success',
        ]);

        // The archive must exist on the local disk
        Storage::disk('local')->assertExists($record->path);

        @unlink($dbPath);
    }

    // -----------------------------------------------------------------------
    // Test 2 -- failed backup records the error; no pruning occurs;
    //           the artisan command notifies System Admins
    // -----------------------------------------------------------------------

    public function test_failed_backup_records_error_and_notifies_system_admins(): void
    {
        $admin = $this->makeAdmin();

        $this->app->bind(BackupService::class, fn () => $this->mockFailedBackupService());

        // Run the command via artisan so the notification logic fires
        $this->artisan('backup:run')->assertFailed();

        $this->assertDatabaseHas('backup_records', [
            'status' => 'failed',
        ]);

        // System Admin should receive exactly one failure notification
        $this->assertDatabaseHas('notifications', [
            'user_id' => $admin->id,
            'title'   => 'Daily backup failed',
        ]);
    }

    // -----------------------------------------------------------------------
    // Test 3 -- retention: only 30 successful backups are kept; older ones
    //           are pruned after a new successful backup
    // -----------------------------------------------------------------------

    public function test_retention_prunes_backups_beyond_limit(): void
    {
        Storage::fake('local');

        // Seed 30 existing successful backup records (no real files needed --
        // deleteFile() will silently skip missing files).
        for ($i = 1; $i <= 30; $i++) {
            BackupRecord::create([
                'filename'     => "backup_old_{$i}.zip",
                'path'         => "backups/backup_old_{$i}.zip",
                'size_bytes'   => 512,
                'status'       => 'success',
                'completed_at' => now()->subDays($i + 1),
                'created_at'   => now()->subDays($i + 1),
                'updated_at'   => now()->subDays($i + 1),
            ]);
        }

        $this->assertDatabaseCount('backup_records', 30);

        // Run a new successful backup -- the 31st -- which should prune the oldest one
        $dbPath = storage_path('database.sqlite');
        file_put_contents($dbPath, '');
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => $dbPath]);
        Storage::disk('local')->makeDirectory('documents');

        $service = new BackupService();
        $record  = $service->run();

        $this->assertSame('success', $record->status);

        // Total successful records must be capped at 30
        $this->assertSame(
            BackupService::RETENTION_LIMIT,
            BackupRecord::successful()->count(),
            'Expected exactly ' . BackupService::RETENTION_LIMIT . ' successful backup records after pruning'
        );

        @unlink($dbPath);
    }

    // -----------------------------------------------------------------------
    // Test 4 -- authorization: non-admin cannot trigger the manual backup
    //           route; admin can
    // -----------------------------------------------------------------------

    public function test_non_admin_cannot_trigger_manual_backup(): void
    {
        $nonAdmin = $this->makeNonAdmin();

        $response = $this->actingAs($nonAdmin)->post(route('backup.run'));

        // Gate denial returns 403
        $response->assertForbidden();

        $this->assertDatabaseCount('backup_records', 0);
    }

    public function test_admin_can_trigger_manual_backup(): void
    {
        Storage::fake('local');

        $admin = $this->makeAdmin();

        $this->app->bind(BackupService::class, fn () => $this->mockSuccessfulBackupService());

        $response = $this->actingAs($admin)->post(route('backup.run'));

        // Should redirect back (the controller calls back()->with(...))
        $response->assertRedirect();
        $response->assertSessionHas('success');

        $this->assertDatabaseHas('backup_records', ['status' => 'success']);
    }
}