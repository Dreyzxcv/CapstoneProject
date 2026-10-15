<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ProfileUpdateAccessTest extends TestCase
{
    use RefreshDatabase;

    private function userWithRole(?string $role): User
    {
        $user = User::factory()->create([
            'name'  => 'Original Name',
            'email' => 'original@example.com',
        ]);

        if ($role) {
            Role::findOrCreate($role, 'web');
            $user->assignRole($role);
        }

        return $user;
    }

    public function test_non_admin_cannot_update_profile_information(): void
    {
        $user = $this->userWithRole('Property Custodian');

        $this->actingAs($user)
            ->patch(route('profile.update'), [
                'name'  => 'Hacked Name',
                'email' => 'hacked@example.com',
            ])
            ->assertForbidden();

        $user->refresh();
        $this->assertSame('Original Name', $user->name);
        $this->assertSame('original@example.com', $user->email);
    }

    public function test_system_admin_can_update_profile_information(): void
    {
        $user = $this->userWithRole('System Admin');

        $this->actingAs($user)
            ->patch(route('profile.update'), [
                'name'  => 'New Name',
                'email' => 'new@example.com',
            ])
            ->assertRedirect(route('profile.edit'));

        $user->refresh();
        $this->assertSame('New Name', $user->name);
        $this->assertSame('new@example.com', $user->email);
    }
}