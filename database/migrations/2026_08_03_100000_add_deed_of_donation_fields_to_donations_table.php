<?php
// database/migrations/2026_08_03_100000_add_deed_of_donation_fields_to_donations_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('donations', function (Blueprint $table) {

            $table->string('donee_position')->nullable()->after('agency_name');

            $table->text('purpose_statement')->nullable()->after('donee_position');

            $table->string('confiscation_order_reference')->nullable()->after('purpose_statement');

            $table->string('donor_representative_name')->nullable()->after('confiscation_order_reference');
            $table->string('donor_representative_title')->nullable()->after('donor_representative_name');

            // Witnesses to the deed's execution.
            $table->string('witness_1_name')->nullable()->after('donor_representative_title');
            $table->string('witness_1_title')->nullable()->after('witness_1_name');
            $table->string('witness_2_name')->nullable()->after('witness_1_title');
            $table->string('witness_2_title')->nullable()->after('witness_2_name');
        });
    }

    public function down(): void
    {
        Schema::table('donations', function (Blueprint $table) {
            $table->dropColumn([
                'donee_position', 'purpose_statement', 'confiscation_order_reference',
                'donor_representative_name', 'donor_representative_title',
                'witness_1_name', 'witness_1_title', 'witness_2_name', 'witness_2_title',
            ]);
        });
    }
};