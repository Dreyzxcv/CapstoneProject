<?php
// database/migrations/2026_07_29_090100_add_market_prices_manage_permission.php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permission = Permission::firstOrCreate(['name' => 'market_prices.manage']);

        Role::where('name', 'System Admin')->first()?->givePermissionTo($permission);
    }

    public function down(): void
    {
        Permission::where('name', 'market_prices.manage')->first()?->delete();
    }
};