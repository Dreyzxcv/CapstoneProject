<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('market_prices', function (Blueprint $table) {
            // 0 = "Whole Year" (default/fallback rate), 1-12 = specific month override.
            $table->unsignedTinyInteger('month')->default(0)->after('year');
        });

        // Existing species+year unique constraint is no longer enough now that
        // multiple rows can share the same species+year (one per month).
        Schema::table('market_prices', function (Blueprint $table) {
            $table->dropUnique(['species', 'year']);
            $table->unique(['species', 'year', 'month']);
        });
    }

    public function down(): void
    {
        Schema::table('market_prices', function (Blueprint $table) {
            $table->dropUnique(['species', 'year', 'month']);
            $table->unique(['species', 'year']);
            $table->dropColumn('month');
        });
    }
};