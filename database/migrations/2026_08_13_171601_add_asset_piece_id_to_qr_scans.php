<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('qr_scans', function (Blueprint $table) {
            $table->foreignId('asset_piece_id')->nullable()->constrained('asset_pieces')->nullOnDelete()->after('asset_id');
        });
    }

    public function down(): void
    {
        Schema::table('qr_scans', function (Blueprint $table) {
            $table->dropForeign(['asset_piece_id']);
            $table->dropColumn('asset_piece_id');
        });
    }
};
