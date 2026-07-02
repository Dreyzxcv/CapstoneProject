<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jevs', function (Blueprint $table) {
            $table->timestamp('uploaded_at')->nullable()->after('uploaded_by_mes_id');
        });

        Schema::table('assets', function (Blueprint $table) {
            // Conveyances get a 15-day appeal window once they reach For Disposal;
            // release vs. forfeiture is decided against this deadline.
            $table->timestamp('appeal_deadline')->nullable()->after('has_confiscation_order');
        });
    }

    public function down(): void
    {
        Schema::table('jevs', function (Blueprint $table) {
            $table->dropColumn('uploaded_at');
        });

        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn('appeal_deadline');
        });
    }
};
