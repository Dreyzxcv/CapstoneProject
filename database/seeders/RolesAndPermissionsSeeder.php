<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            'assets.view',
            'assets.create',
            'assets.sign_receipt',
            'assets.mark_stored',
            'assets.generate_qr',
            'assets.update_case',
            'assets.scan',
            'incidents.create',
            'jev.create',
            'jev.upload',
            'disposals.view',
            'disposals.process',
            'reports.view',
            'reports.export',
            'audit.view',
            'users.manage',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        $rolePermissions = [
            'System Admin' => $permissions,
            'MES Officer' => [
                'assets.view', 'assets.create', 'assets.update_case', 'assets.scan', 'incidents.create',
                'jev.upload', 'disposals.view', 'reports.view',
            ],
            'Property Custodian' => [
                'assets.view', 'assets.sign_receipt', 'assets.mark_stored',
                'assets.generate_qr', 'assets.scan', 'reports.view',
            ],
            'Accounting Officer' => [
                'assets.view', 'jev.create', 'disposals.view', 'disposals.process',
                'reports.view', 'reports.export',
            ],
            'PENRO Management' => [
                'assets.view', 'disposals.view', 'reports.view', 'reports.export',
            ],
        ];

        foreach ($rolePermissions as $roleName => $perms) {
            $role = Role::firstOrCreate(['name' => $roleName]);
            $role->syncPermissions($perms);
        }
    }
}
