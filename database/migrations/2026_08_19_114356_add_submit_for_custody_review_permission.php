<?php

use Illuminate\Database\Migrations\Migration;

class AddSubmitForCustodyReviewPermission extends Migration
{
    public function up(): void
    {
        \Spatie\Permission\Models\Permission::firstOrCreate([
            'name' => 'assets.submit_custody_review', 
            'guard_name' => 'web',
        ]);
    }

    public function down(): void
    {
        \Spatie\Permission\Models\Permission::where('name', 'assets.submit_custody_review')
            ->where('guard_name', 'web')
            ->delete();
    }
}