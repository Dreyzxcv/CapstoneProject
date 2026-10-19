<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\AreaPermissions;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class UsersManagementTest extends TestCase
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
        Role::findOrCreate('Unassigned Role', 'web'); // exists, but no user has it

        $this->admin = $this->makeUser(AreaPermissions::ADMIN_ROLE);
    }

    private function makeUser(string $role, array $attributes = []): User
    {
        $user = User::factory()->create(array_merge([
            'is_active' => true,
            'email_verified_at' => now(),
        ], $attributes));
        $user->assignRole($role);

        return $user;
    }

    public function test_index_offers_every_available_role_including_unassigned_ones(): void
    {
        $this->actingAs($this->admin)
            ->get(route('users.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Settings/Admin/Users/Index')
                ->where('availableRoles', fn ($roles) => collect($roles)->contains('Unassigned Role'))
                ->has('users', 1)
                ->has('result')
            );
    }

    public function test_index_exposes_last_login_so_the_page_can_filter_never_logged_in(): void
    {
        $never = $this->makeUser('MES Officer', ['last_login_at' => null]);
        $seen = $this->makeUser('MES Officer', ['last_login_at' => now()->subDay()]);

        $this->actingAs($this->admin)
            ->get(route('users.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('users', fn ($users) => collect($users)->firstWhere('id', $never->id)['last_login_at'] === null
                    && collect($users)->firstWhere('id', $seen->id)['last_login_at'] !== null)
            );
    }

    public function test_non_admin_cannot_view_the_user_list(): void
    {
        $this->actingAs($this->makeUser('MES Officer'))
            ->get(route('users.index'))
            ->assertForbidden();
    }

    public function test_password_reset_reports_success(): void
    {
        Notification::fake();
        $target = $this->makeUser('MES Officer');

        $this->actingAs($this->admin)
            ->from(route('users.index'))
            ->post(route('users.send-reset', $target))
            ->assertRedirect(route('users.index'))
            ->assertSessionHas('success', "Password reset link sent to {$target->email}.")
            ->assertSessionMissing('error');
    }

    public function test_password_reset_reports_failure_when_throttled(): void
    {
        Notification::fake();
        $target = $this->makeUser('MES Officer');

        $this->actingAs($this->admin)->post(route('users.send-reset', $target));

        $this->actingAs($this->admin)
            ->from(route('users.index'))
            ->post(route('users.send-reset', $target))
            ->assertSessionHas('error')
            ->assertSessionMissing('success');
    }

    public function test_failure_message_is_passed_to_the_page_as_result(): void
    {
        $this->actingAs($this->admin)
            ->withSession(['error' => 'Something went wrong.'])
            ->get(route('users.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('result.error', 'Something went wrong.')
                ->where('result.success', null)
            );
    }

    public function test_toggle_active_deactivates_and_reactivates(): void
    {
        $target = $this->makeUser('MES Officer');

        $this->actingAs($this->admin)->patch(route('users.toggle-active', $target))
            ->assertSessionHas('success', "{$target->name}'s account has been deactivated.");
        $this->assertFalse($target->fresh()->is_active);

        $this->actingAs($this->admin)->patch(route('users.toggle-active', $target))
            ->assertSessionHas('success', "{$target->name}'s account has been reactivated.");
        $this->assertTrue($target->fresh()->is_active);
    }

    public function test_admin_cannot_deactivate_own_account(): void
    {
        $this->actingAs($this->admin)
            ->patch(route('users.toggle-active', $this->admin))
            ->assertSessionHas('error', 'You cannot deactivate your own account.');

        $this->assertTrue($this->admin->fresh()->is_active);
    }

    public function test_update_keeps_the_single_role_policy(): void
    {
        $target = $this->makeUser('MES Officer');
        $target->assignRole('Property Custodian'); // legacy account with two roles

        $this->actingAs($this->admin)
            ->put(route('users.update', $target), [
                'name' => $target->name,
                'email' => $target->email,
                'role' => 'Property Custodian',
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(['Property Custodian'], $target->fresh()->getRoleNames()->all());
    }

    public function test_update_and_store_reject_multiple_roles_in_one_request(): void
    {
        $target = $this->makeUser('MES Officer');

        $this->actingAs($this->admin)
            ->put(route('users.update', $target), [
                'name' => $target->name,
                'email' => $target->email,
                'role' => ['MES Officer', 'Property Custodian'],
            ])
            ->assertSessionHasErrors('role');

        $this->actingAs($this->admin)
            ->post(route('users.store'), [
                'name' => 'New Person',
                'email' => 'new.person@example.test',
                'password' => 'Str0ng!Passw0rd#',
                'password_confirmation' => 'Str0ng!Passw0rd#',
                'role' => ['MES Officer', 'Property Custodian'],
            ])
            ->assertSessionHasErrors('role');

        $this->assertSame(['MES Officer'], $target->fresh()->getRoleNames()->all());
    }

    public function test_store_creates_an_active_account_with_one_role(): void
    {
        $this->actingAs($this->admin)
            ->post(route('users.store'), [
                'name' => 'New Person',
                'email' => 'new.person@example.test',
                'password' => 'Str0ng!Passw0rd#',
                'password_confirmation' => 'Str0ng!Passw0rd#',
                'role' => 'MES Officer',
            ])
            ->assertRedirect(route('users.index'))
            ->assertSessionHas('success', 'Account created for New Person.');

        $created = User::where('email', 'new.person@example.test')->firstOrFail();
        $this->assertTrue($created->is_active);
        $this->assertSame(['MES Officer'], $created->getRoleNames()->all());
    }
}