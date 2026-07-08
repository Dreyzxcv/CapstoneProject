<?php
// database/migrations/2026_07_08_100000_add_incidents_create_permission.php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permission = Permission::firstOrCreate(['name' => 'incidents.create']);

        foreach (['System Admin', 'MES Officer'] as $roleName) {
            $role = Role::where('name', $roleName)->first();
            $role?->givePermissionTo($permission);
        }
    }

    public function down(): void
    {
        $permission = Permission::where('name', 'incidents.create')->first();
        $permission?->delete();
    }
};