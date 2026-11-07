<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserPermissionsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function userWithRole(string $role): User
    {
        $u = User::factory()->create(['is_active' => true, 'email_verified_at' => now()]);
        $u->assignRole($role);
        return $u;
    }

    private function setAreas(User $admin, User $target, array $areas)
    {
        $areas = array_merge(['assets' => true, 'disposals' => true, 'jev' => true, 'reports' => true], $areas);
        return $this->actingAs($admin)->put(route('users.permissions.update', $target), ['areas' => $areas]);
    }

    public function test_role_default_grants_view(): void
    {
        $this->actingAs($this->userWithRole('PENRO Management'))->get(route('assets.index'))->assertSuccessful();
    }

    public function test_revoking_overrides_role_grant_on_page_and_actions(): void
    {
        $admin = $this->userWithRole('System Admin');
        $mes = $this->userWithRole('MES Officer');
        $this->assertTrue($mes->can('assets.scan'));

        $this->setAreas($admin, $mes, ['assets' => false])->assertRedirect();

        $this->actingAs($mes->fresh())->get(route('assets.index'))->assertForbidden();
        $this->assertFalse($mes->fresh()->can('assets.update'));
        $this->assertFalse($mes->fresh()->can('assets.scan'));
        $this->actingAs($mes->fresh())->get(route('reports.index'))->assertSuccessful(); // other areas intact
    }

    public function test_granting_view_beyond_role_and_reverting(): void
    {
        $admin = $this->userWithRole('System Admin');
        $mes = $this->userWithRole('MES Officer'); // no jev.view by role
        $this->actingAs($mes)->get(route('jev.index'))->assertForbidden();

        $this->setAreas($admin, $mes, ['jev' => true]);
        $this->actingAs($mes->fresh())->get(route('jev.index'))->assertSuccessful();
        $this->assertFalse($mes->fresh()->can('jev.create')); // grant is view-only

        $this->setAreas($admin, $mes, ['jev' => false]);
        $this->actingAs($mes->fresh())->get(route('jev.index'))->assertForbidden();
    }

    public function test_override_matching_role_default_is_not_stored(): void
    {
        $admin = $this->userWithRole('System Admin');
        $u = $this->userWithRole('PENRO Management');
        $this->setAreas($admin, $u, ['jev' => false]); // role lacks jev already
        $this->assertDatabaseCount('user_permission_overrides', 0);
    }

    public function test_non_admin_cannot_update_permissions(): void
    {
        $actor = $this->userWithRole('MES Officer');
        $target = $this->userWithRole('PENRO Management');
        $this->setAreas($actor, $target, ['assets' => false])->assertForbidden();
        $this->assertDatabaseCount('user_permission_overrides', 0);
    }

    public function test_system_admin_cannot_be_restricted_and_unknown_areas_rejected(): void
    {
        $admin = $this->userWithRole('System Admin');
        $other = $this->userWithRole('System Admin');
        $this->setAreas($admin, $other, ['assets' => false])->assertForbidden();

        $target = $this->userWithRole('MES Officer');
        $this->actingAs($admin)->put(route('users.permissions.update', $target), [
            'areas' => ['assets' => true, 'disposals' => true, 'jev' => true, 'reports' => true, 'users' => true],
        ])->assertSessionHasErrors('areas');
    }

    public function test_admin_only_routes_stay_admin_only(): void
    {
        $routes = ['users.index', 'users.create', 'audit-logs.index', 'market-prices.index'];

        foreach (['MES Officer', 'Property Custodian', 'Accounting Officer', 'PENRO Management'] as $role) {
            $u = $this->userWithRole($role);
            // even a forged override row must not open admin areas
            $u->permissionOverrides()->create(['permission' => 'users.manage', 'allowed' => true]);
            foreach ($routes as $name) {
                $this->actingAs($u->fresh())->get(route($name))->assertForbidden();
            }
        }

        $admin = $this->userWithRole('System Admin');
        foreach ($routes as $name) {
            $this->actingAs($admin)->get(route($name))->assertSuccessful();
        }
    }

    public function test_admin_ignores_overrides(): void
    {
        $admin = $this->userWithRole('System Admin');
        $admin->permissionOverrides()->create(['permission' => 'assets.view', 'allowed' => false]);
        $this->assertTrue($admin->fresh()->can('assets.view'));
    }
}