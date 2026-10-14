<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('incident_claimants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('incident_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('address', 500);
            $table->string('contact_number', 50)->nullable();
            $table->string('id_type', 100)->nullable();
            $table->string('id_number', 100)->nullable();
            $table->timestamps();
        });

        Schema::table('incidents', function (Blueprint $table) {
            $table->dropColumn([
                'claimant_offender_name',
                'claimant_address',
                'claimant_contact_number',
                'claimant_id_type',
                'claimant_id_number',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->string('claimant_offender_name')->nullable();
            $table->string('claimant_address', 500)->nullable();
            $table->string('claimant_contact_number', 50)->nullable();
            $table->string('claimant_id_type', 100)->nullable();
            $table->string('claimant_id_number', 100)->nullable();
        });

        Schema::dropIfExists('incident_claimants');
    }
};