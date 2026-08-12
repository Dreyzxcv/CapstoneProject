<?php
// database/migrations/2026_08_12_090100_add_assets_update_aap_permission.php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permission = Permission::firstOrCreate(['name' => 'assets.update_aap']);

        foreach (['System Admin', 'MES Officer'] as $roleName) {
            Role::where('name', $roleName)->first()?->givePermissionTo($permission);
        }
    }

    public function down(): void
    {
        Permission::where('name', 'assets.update_aap')->first()?->delete();
    }
};