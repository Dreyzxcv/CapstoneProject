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

        // Only assign if roles exist -- they may not during fresh migration
        $systemAdmin = Role::whereName('System Admin')->first();
        if ($systemAdmin) {
            $systemAdmin->givePermissionTo($permission);
        }

        $accountingOfficer = Role::whereName('Accounting Officer')->first();
        if ($accountingOfficer) {
            $accountingOfficer->givePermissionTo($permission);
        }
    }

    public function down(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permission = Permission::findByName('jev.view');

        Role::whereName('System Admin')->first()?->revokePermissionTo($permission);
        Role::whereName('Accounting Officer')->first()?->revokePermissionTo($permission);

        $permission->delete();
    }
};