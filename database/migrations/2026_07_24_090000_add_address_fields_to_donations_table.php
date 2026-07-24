<?php
// database/migrations/2026_07_24_090000_add_address_fields_to_donations_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('donations', function (Blueprint $table) {
            $table->string('municipality')->nullable()->after('agency_name');
            $table->string('barangay')->nullable()->after('municipality');
            $table->string('street')->nullable()->after('barangay');
        });
    }

    public function down(): void
    {
        Schema::table('donations', function (Blueprint $table) {
            $table->dropColumn(['municipality', 'barangay', 'street']);
        });
    }
};