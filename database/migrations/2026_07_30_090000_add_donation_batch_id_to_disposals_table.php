<?php
// database/migrations/2026_07_30_090000_add_donation_batch_id_to_disposals_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('disposals', function (Blueprint $table) {
            $table->uuid('donation_batch_id')->nullable()->after('asset_id');
            $table->index('donation_batch_id');
        });
    }

    public function down(): void
    {
        Schema::table('disposals', function (Blueprint $table) {
            $table->dropIndex(['donation_batch_id']);
            $table->dropColumn('donation_batch_id');
        });
    }
};