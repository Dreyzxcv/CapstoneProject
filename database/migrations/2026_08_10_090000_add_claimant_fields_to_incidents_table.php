<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            // Replaces the old is_abandoned flag — kept in the table for now
            // (not dropped) to avoid destructive migration on existing rows,
            // but the app no longer reads/writes it.
            $table->boolean('has_claimant')->default(true)->after('claimant_offender_name');
            $table->string('claimant_address')->nullable()->after('has_claimant');
            $table->string('claimant_contact_number')->nullable()->after('claimant_address');
            $table->string('claimant_id_type')->nullable()->after('claimant_contact_number');
            $table->string('claimant_id_number')->nullable()->after('claimant_id_type');
        });
    }

    public function down(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->dropColumn([
                'has_claimant', 'claimant_address', 'claimant_contact_number',
                'claimant_id_type', 'claimant_id_number',
            ]);
        });
    }
};