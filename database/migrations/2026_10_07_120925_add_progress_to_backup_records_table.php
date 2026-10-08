<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('backup_records', function (Blueprint $table) {
            $table->unsignedTinyInteger('progress')->default(0);
            $table->string('stage')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('backup_records', function (Blueprint $table) {
            $table->dropColumn(['progress', 'stage']);
        });
    }
};
