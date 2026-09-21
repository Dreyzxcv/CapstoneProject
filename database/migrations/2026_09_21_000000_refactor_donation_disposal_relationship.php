<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add donation_id to disposals
        Schema::table('disposals', function (Blueprint $table) {
            $table->foreignId('donation_id')->nullable()->after('asset_id')->constrained('donations')->nullOnDelete();
        });

        // 2. Migrate existing data — copy disposal_id → donation_id on disposals
        DB::statement('
            UPDATE disposals
            SET donation_id = donations.id
            FROM donations
            WHERE donations.disposal_id = disposals.id
        ');

        // 3. Drop old FK and column from donations
        Schema::table('donations', function (Blueprint $table) {
            $table->dropForeign(['disposal_id']);
            $table->dropColumn('disposal_id');
        });
    }

    public function down(): void
    {
        Schema::table('donations', function (Blueprint $table) {
            $table->foreignId('disposal_id')->nullable()->constrained('disposals')->nullOnDelete();
        });

        DB::statement('
            UPDATE donations
            SET disposal_id = disposals.id
            FROM disposals
            WHERE disposals.donation_id = donations.id
        ');

        Schema::table('disposals', function (Blueprint $table) {
            $table->dropForeign(['donation_id']);
            $table->dropColumn('donation_id');
        });
    }
};