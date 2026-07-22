<?php
// database/migrations/2026_07_22_090000_add_donation_org_and_photo_fields.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('donations', function (Blueprint $table) {
            $table->string('organization_type')->nullable()->after('requester_name');
            $table->string('organization_type_other')->nullable()->after('organization_type');
            $table->string('agency_name')->nullable()->after('organization_type_other');
            $table->string('release_photo_path')->nullable()->after('deed_of_donation_path');
        });
    }

    public function down(): void
    {
        Schema::table('donations', function (Blueprint $table) {
            $table->dropColumn(['organization_type', 'organization_type_other', 'agency_name', 'release_photo_path']);
        });
    }
};