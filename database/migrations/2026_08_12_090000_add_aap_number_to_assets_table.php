<?php
// database/migrations/2026_08_12_090000_add_aap_number_to_assets_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            // Apprehension and Acceptance Paper No. — reference number tied
            // to the scanned AAP document (DocumentType::AapDocument),
            // distinct from the asset's own asset_code. Null until MES
            // uploads/receives the AAP, editable afterward by MES/Admin.
            $table->string('aap_number')->nullable()->after('asset_code');
        });
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn('aap_number');
        });
    }
};