<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permission = Permission::firstOrCreate(['name' => 'jev.view']);

        // System Admin already has all permissions — give it this one too
        Role::findByName('System Admin')->givePermissionTo($permission);

        // Accounting Officer is the JEV role
        Role::findByName('Accounting Officer')->givePermissionTo($permission);
    }

    public function down(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permission = Permission::findByName('jev.view');

        Role::findByName('System Admin')->revokePermissionTo($permission);
        Role::findByName('Accounting Officer')->revokePermissionTo($permission);

        $permission->delete();
    }
};