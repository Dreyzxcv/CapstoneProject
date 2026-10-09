<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('asset_case_status_history', function (Blueprint $table) {
            $table->string('event_type', 30)->default('status_change');
            $table->json('changed_fields')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('asset_case_status_history', function (Blueprint $table) {
            $table->dropColumn(['event_type', 'changed_fields']);
        });
    }
};
