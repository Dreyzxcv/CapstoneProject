<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use App\Services\AuditLogService;
use App\Support\AreaPermissions;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Inertia\Testing\AssertableInertia as Assert;
use RuntimeException;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class UserInvitationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $manage = Permission::findOrCreate('users.manage', 'web');
        Role::findOrCreate(AreaPermissions::ADMIN_ROLE, 'web')->givePermissionTo($manage);
        Role::findOrCreate('MES Officer', 'web');
        Role::findOrCreate('Property Custodian', 'web');

        $this->admin = $this->makeUser(AreaPermissions::ADMIN_ROLE);
    }

    private function makeUser(string $role, array $attrs = []): User
    {
        $user = User::factory()->create(array_merge(['is_active' => true, 'email_verified_at' => now()], $attrs));
        $user->assignRole($role);

        return $user;
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'New Person',
            'email' => 'new.person@example.test',
            'role' => 'MES Officer',
        ], $overrides);
    }

    public function test_non_admin_cannot_open_or_submit_the_form(): void
    {
        $officer = $this->makeUser('MES Officer');

        $this->actingAs($officer)->get(route('users.create'))->assertForbidden();
        $this->actingAs($officer)->post(route('users.store'), $this->payload())->assertForbidden();
        $this->assertDatabaseMissing('users', ['email' => 'new.person@example.test']);
    }

    public function test_create_page_lists_roles_with_privilege_flag(): void
    {
        $this->actingAs($this->admin)->get(route('users.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Settings/Admin/Users/Create')
                ->where('roles', fn ($roles) => collect($roles)->firstWhere('name', AreaPermissions::ADMIN_ROLE)['privileged'] === true
                    && collect($roles)->firstWhere('name', 'MES Officer')['privileged'] === false));
    }

    public function test_store_creates_active_verified_user_with_one_role_and_sends_link(): void
    {
        Notification::fake();

        $this->actingAs($this->admin)->post(route('users.store'), $this->payload())
            ->assertRedirect(route('users.index'))
            ->assertSessionHas('success');

        $created = User::where('email', 'new.person@example.test')->firstOrFail();
        $this->assertTrue($created->is_active);
        $this->assertNotNull($created->email_verified_at);
        $this->assertSame(['MES Officer'], $created->getRoleNames()->all());
        Notification::assertSentTo($created, ResetPassword::class);
    }

    public function test_name_and_email_are_normalized(): void
    {
        Notification::fake();

        $this->actingAs($this->admin)->post(route('users.store'), $this->payload([
            'name' => "  Juan   dela  Cruz ",
            'email' => '  Juan.Cruz@Example.TEST ',
        ]))->assertSessionHasNoErrors();

        $this->assertDatabaseHas('users', ['name' => 'Juan dela Cruz', 'email' => 'juan.cruz@example.test']);
    }

    public function test_whitespace_only_name_is_rejected(): void
    {
        $this->actingAs($this->admin)->post(route('users.store'), $this->payload(['name' => "   \t "]))
            ->assertSessionHasErrors('name');
        $this->assertDatabaseMissing('users', ['email' => 'new.person@example.test']);
    }

    public function test_duplicate_and_case_varied_emails_are_rejected(): void
    {
        $existing = $this->makeUser('MES Officer', ['email' => 'taken@example.test']);

        foreach (['taken@example.test', 'TAKEN@Example.Test', '  Taken@example.test '] as $email) {
            $this->actingAs($this->admin)->post(route('users.store'), $this->payload(['email' => $email]))
                ->assertSessionHasErrors('email');
        }
        $this->assertSame(1, User::where('email', $existing->email)->count());
    }

    public function test_invalid_missing_and_array_roles_are_rejected(): void
    {
        foreach (['Nonexistent Role', '', ['MES Officer', 'Property Custodian'], ['role' => 'MES Officer']] as $role) {
            $this->actingAs($this->admin)->post(route('users.store'), $this->payload(['role' => $role]))
                ->assertSessionHasErrors('role');
        }
        $this->assertDatabaseMissing('users', ['email' => 'new.person@example.test']);
    }

    public function test_privileged_role_requires_acknowledgement(): void
    {
        Notification::fake();
        $payload = $this->payload(['role' => AreaPermissions::ADMIN_ROLE]);

        $this->actingAs($this->admin)->post(route('users.store'), $payload)
            ->assertSessionHasErrors('acknowledge_privileged');
        $this->assertDatabaseMissing('users', ['email' => 'new.person@example.test']);

        $this->actingAs($this->admin)->post(route('users.store'), $payload + ['acknowledge_privileged' => true])
            ->assertSessionHasNoErrors();
        $this->assertTrue(User::where('email', 'new.person@example.test')->first()->isSystemAdmin());
    }

    public function test_password_fields_are_ignored_and_no_known_password_exists(): void
    {
        Notification::fake();

        $this->actingAs($this->admin)->post(route('users.store'), $this->payload([
            'password' => 'Str0ng!Passw0rd#',
            'password_confirmation' => 'different',
        ]))->assertSessionHasNoErrors();

        $created = User::where('email', 'new.person@example.test')->firstOrFail();
        $this->assertFalse(\Hash::check('Str0ng!Passw0rd#', $created->password));
    }

    public function test_audit_log_records_actor_user_email_role_but_no_secrets(): void
    {
        Notification::fake();

        $this->actingAs($this->admin)->post(route('users.store'), $this->payload());

        $created = User::where('email', 'new.person@example.test')->firstOrFail();
        $log = AuditLog::where('action', 'user.created')->firstOrFail();

        $this->assertSame($this->admin->id, $log->user_id);
        $this->assertSame($created->id, $log->model_id);
        $this->assertSame('new.person@example.test', $log->new_values['email']);
        $this->assertSame('MES Officer', $log->new_values['role']);
        $this->assertStringNotContainsStringIgnoringCase('password', json_encode($log->new_values));
        $this->assertStringNotContainsStringIgnoringCase('token', json_encode($log->new_values));
    }

    public function test_failed_reset_link_keeps_account_and_reports_error(): void
    {
        Password::shouldReceive('sendResetLink')->once()->andReturn(Password::INVALID_USER);

        $this->actingAs($this->admin)->post(route('users.store'), $this->payload())
            ->assertRedirect(route('users.index'))
            ->assertSessionHas('error')
            ->assertSessionMissing('success');

        $this->assertDatabaseHas('users', ['email' => 'new.person@example.test']);
    }

    public function test_exception_while_sending_link_is_reported_as_failure(): void
    {
        Password::shouldReceive('sendResetLink')->once()->andThrow(new RuntimeException('SMTP down'));

        $this->actingAs($this->admin)->post(route('users.store'), $this->payload())
            ->assertSessionHas('error');
        $this->assertDatabaseHas('users', ['email' => 'new.person@example.test']);
    }

    public function test_user_and_role_are_rolled_back_if_audit_logging_fails(): void
    {
        $this->mock(AuditLogService::class, fn ($m) => $m->shouldReceive('log')->andThrow(new RuntimeException('audit down')));
        $this->withoutExceptionHandling();

        try {
            $this->actingAs($this->admin)->post(route('users.store'), $this->payload());
            $this->fail('Expected the audit failure to propagate.');
        } catch (RuntimeException) {
            // expected
        }

        $this->assertDatabaseMissing('users', ['email' => 'new.person@example.test']);
    }
}