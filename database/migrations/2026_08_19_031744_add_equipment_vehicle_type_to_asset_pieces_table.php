<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('asset_pieces', function (Blueprint $table) {
            $table->string('equipment_type')->nullable()->after('species');
            $table->string('vehicle_type')->nullable()->after('equipment_type');
        });
    }

    public function down(): void
    {
        Schema::table('asset_pieces', function (Blueprint $table) {
            $table->dropColumn(['equipment_type', 'vehicle_type']);
        });
    }
};
