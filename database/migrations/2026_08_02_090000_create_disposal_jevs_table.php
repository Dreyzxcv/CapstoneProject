<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('disposal_jevs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('disposal_id')->constrained()->cascadeOnDelete();
            $table->string('jev_number')->unique();
            $table->string('funding_source_code')->nullable();
            $table->string('funding_source_label')->nullable();
            $table->string('transaction_type')->nullable();
            $table->string('transaction_code')->nullable();
            $table->string('responsibility_center')->nullable();
            $table->text('particulars')->nullable();
            $table->string('document_no')->nullable();
            $table->string('prepared_by_name')->nullable();
            $table->string('approved_by_name')->nullable();
            $table->json('line_items')->nullable();
            $table->foreignId('issued_by_accounting_id')->constrained('users');
            $table->string('pdf_path')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('disposal_jevs');
    }
};