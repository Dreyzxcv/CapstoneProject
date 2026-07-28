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

        $permission = Permission::firstOrCreate(['name' => 'documents.verify']);

        foreach (['System Admin', 'Property Custodian'] as $roleName) {
            Role::where('name', $roleName)->first()?->givePermissionTo($permission);
        }
    }

    public function down(): void
    {
        Permission::where('name', 'documents.verify')->first()?->delete();
    }
};