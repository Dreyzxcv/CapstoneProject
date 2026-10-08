<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('backup_settings', function (Blueprint $table) {
            $table->id();
            $table->boolean('auto_enabled')->default(true);
            $table->string('frequency')->default('daily');
            $table->string('time', 5)->default('02:00');
            $table->unsignedTinyInteger('day_of_week')->default(0);
            $table->unsignedSmallInteger('retention_days')->default(30);
            $table->timestamp('last_auto_run_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backup_settings');
    }
};
