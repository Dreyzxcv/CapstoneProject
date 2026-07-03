<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jevs', function (Blueprint $table) {
            $table->string('funding_source_code')->nullable()->after('jev_number');
            $table->string('funding_source_label')->nullable()->after('funding_source_code');
            $table->string('transaction_type')->nullable()->after('funding_source_label');
            $table->string('transaction_code')->nullable()->after('transaction_type');
            $table->string('responsibility_center')->nullable()->after('transaction_code');
            $table->text('particulars')->nullable()->after('responsibility_center');
            $table->string('document_no')->nullable()->after('particulars');
            $table->string('prepared_by_name')->nullable()->after('document_no');
            $table->string('approved_by_name')->nullable()->after('prepared_by_name');
            $table->json('line_items')->nullable()->after('approved_by_name');
        });
    }

    public function down(): void
    {
        Schema::table('jevs', function (Blueprint $table) {
            $table->dropColumn([
                'funding_source_code', 'funding_source_label', 'transaction_type',
                'transaction_code', 'responsibility_center', 'particulars',
                'document_no', 'prepared_by_name', 'approved_by_name', 'line_items',
            ]);
        });
    }
};