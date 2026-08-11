<?php
// database/migrations/2026_08_11_090000_add_initial_custodian_name_to_incidents_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            // Data Encoding Module (NewFlow.pdf Stage 1, box 2): the person
            // or office that held the asset before it reached PENRO custody
            // — distinct from apprehending_party (who caught it) and from
            // the eventual Property Custodian (Stage 2).
            $table->string('initial_custodian_name')->nullable()->after('apprehending_party');
        });
    }

    public function down(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->dropColumn('initial_custodian_name');
        });
    }
};