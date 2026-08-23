<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('asset_pieces', function (Blueprint $table) {
            $table->string('serial_number')->nullable()->after('plate_number');
        });
    }

    public function down(): void
    {
        Schema::table('asset_pieces', function (Blueprint $table) {
            $table->dropColumn('serial_number');
        });
    }
};