<?php

use Illuminate\Database\Migrations\Migration;

class AddSubmitForCustodyReviewPermission extends Migration
{
    public function up(): void
    {
        $permission = \Spatie\Permission\Models\Permission::firstOrCreate([
            'name' => 'assets.submit_for_custody_review',
            'guard_name' => 'web',
        ]);

        $mesRole = \Spatie\Permission\Models\Role::findByName('MES Officer');
        $mesRole->givePermissionTo($permission);
    }

    public function down(): void
    {
        $permission = \Spatie\Permission\Models\Permission::findByName(
            'assets.submit_for_custody_review',
            'web'
        );

        $permission?->delete();
    }
}