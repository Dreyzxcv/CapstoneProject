<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('backup_settings', function (Blueprint $table) {
            $table->string('backup_path', 500)->nullable();
        });

        Schema::table('backup_records', function (Blueprint $table) {
            $table->string('full_path', 600)->nullable();   
        });
    }

    public function down(): void
    {
        Schema::table('backup_settings', fn (Blueprint $t) => $t->dropColumn('backup_path'));
        Schema::table('backup_records', fn (Blueprint $t) => $t->dropColumn('full_path'));
    }
};
