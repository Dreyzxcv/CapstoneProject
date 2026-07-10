<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assets', function (Blueprint $table) {
            $table->id();
            $table->string('asset_code')->unique();
            $table->string('type');
            $table->string('species')->nullable();
            $table->text('description')->nullable();
            $table->string('municipality_of_origin');
            $table->string('location_apprehended');
            $table->string('apprehending_agency');
            $table->string('mode');
            $table->boolean('has_ongoing_case')->default(false);
            $table->boolean('has_confiscation_order')->default(false);
            $table->string('current_status');
            $table->string('qr_code_token', 64)->unique();
            $table->json('metadata')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();

            $table->index('current_status');
            $table->index('type');
            $table->index('municipality_of_origin');
        });

        Schema::create('asset_case_status_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->string('status');
            $table->foreignId('changed_by')->constrained('users');
            $table->text('notes')->nullable();
            $table->timestamp('changed_at');
            $table->timestamps();
        });

        Schema::create('acknowledgement_receipts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->string('receipt_number')->unique();
            $table->foreignId('signed_by_custodian_id')->nullable()->constrained('users');
            $table->timestamp('signed_at')->nullable();
            $table->string('pdf_path')->nullable();
            $table->timestamps();
        });

        Schema::create('jevs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->string('jev_number')->unique();
            $table->foreignId('created_by_accounting_id')->constrained('users');
            $table->foreignId('uploaded_by_mes_id')->nullable()->constrained('users');
            $table->string('pdf_path')->nullable();
            $table->timestamps();
        });

        Schema::create('disposals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->string('disposal_type');
            $table->json('details')->nullable();
            $table->string('report_pdf_path')->nullable();
            $table->foreignId('processed_by')->constrained('users');
            $table->timestamp('processed_at');
            $table->timestamps();
        });

        Schema::create('donations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('disposal_id')->constrained()->cascadeOnDelete();
            $table->string('requester_name');
            $table->string('deed_of_donation_path')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamps();
        });

        Schema::create('ics_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('disposal_id')->constrained()->cascadeOnDelete();
            $table->string('document_number')->unique();
            $table->string('pdf_path')->nullable();
            $table->foreignId('issued_by')->constrained('users');
            $table->timestamp('issued_at');
            $table->timestamps();
        });

        Schema::create('par_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('disposal_id')->constrained()->cascadeOnDelete();
            $table->string('document_number')->unique();
            $table->string('pdf_path')->nullable();
            $table->foreignId('issued_by')->constrained('users');
            $table->timestamp('issued_at');
            $table->timestamps();
        });

        Schema::create('qr_scans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->foreignId('scanned_by')->constrained('users');
            $table->string('scan_location_note')->nullable();
            $table->string('resulting_status');
            $table->timestamp('scanned_at');
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action');
            $table->string('model_type')->nullable();
            $table->unsignedBigInteger('model_id')->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->morphs('attachable');
            $table->string('file_path');
            $table->string('original_name');
            $table->string('mime_type')->nullable();
            $table->foreignId('uploaded_by')->constrained('users');
            $table->timestamp('uploaded_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('qr_scans');
        Schema::dropIfExists('par_records');
        Schema::dropIfExists('ics_records');
        Schema::dropIfExists('donations');
        Schema::dropIfExists('disposals');
        Schema::dropIfExists('jevs');
        Schema::dropIfExists('acknowledgement_receipts');
        Schema::dropIfExists('asset_case_status_history');
        Schema::dropIfExists('assets');
    }
};
