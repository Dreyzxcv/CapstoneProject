<?php
// database/migrations/2026_07_15_090100_add_documents_upload_permission.php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permission = Permission::firstOrCreate(['name' => 'documents.upload']);

        // PENRO Management stays read-only, per the spec — everyone else who
        // touches an asset's paperwork can attach supporting photos.
        foreach (['System Admin', 'MES Officer', 'Property Custodian', 'Accounting Officer'] as $roleName) {
            Role::where('name', $roleName)->first()?->givePermissionTo($permission);
        }
    }

    public function down(): void
    {
        Permission::where('name', 'documents.upload')->first()?->delete();
    }
};