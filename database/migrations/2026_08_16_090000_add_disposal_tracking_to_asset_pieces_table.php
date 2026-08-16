<?php
// database/migrations/2026_08_16_090000_add_disposal_tracking_to_asset_pieces_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('asset_pieces', function (Blueprint $table) {
            $table->foreignId('disposal_id')->nullable()->after('qr_code_token')
                ->constrained()->nullOnDelete();
            $table->timestamp('disposed_at')->nullable()->after('disposal_id');
        });
    }

    public function down(): void
    {
        Schema::table('asset_pieces', function (Blueprint $table) {
            $table->dropConstrainedForeignId('disposal_id');
            $table->dropColumn('disposed_at');
        });
    }
};