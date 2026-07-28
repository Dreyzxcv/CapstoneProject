<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->string('document_type')->nullable()->after('attachable_id');
            $table->string('status')->default('pending')->after('mime_type');
            $table->text('remarks')->nullable()->after('status');
            $table->foreignId('verified_by')->nullable()->after('remarks')->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable()->after('verified_by');
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropConstrainedForeignId('verified_by');
            $table->dropColumn(['document_type', 'status', 'remarks', 'verified_at']);
        });
    }
};