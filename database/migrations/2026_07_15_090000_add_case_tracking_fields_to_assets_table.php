<?php
// database/migrations/2026_07_15_090000_add_case_tracking_fields_to_assets_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->string('case_number')->nullable()->after('has_ongoing_case');
            $table->string('court_branch')->nullable()->after('case_number');
            $table->date('next_hearing_date')->nullable()->after('court_branch');
        });
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn(['case_number', 'court_branch', 'next_hearing_date']);
        });
    }
};