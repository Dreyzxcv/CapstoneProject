<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('incidents', function (Blueprint $table) {
            $table->id();
            $table->string('incident_code')->unique();
            $table->date('date_of_apprehension');
            $table->string('place_of_apprehension');
            $table->string('area')->nullable();
            $table->string('coordinates')->nullable();
            $table->string('claimant_offender_name')->nullable();
            $table->boolean('is_abandoned')->default(false);
            $table->string('apprehending_party');
            $table->date('date_report_submitted')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();

            $table->index('date_of_apprehension');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incidents');
    }
};