<?php
// database/migrations/2026_08_03_090000_add_upload_fields_to_disposal_jevs_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('disposal_jevs', function (Blueprint $table) {
            $table->foreignId('uploaded_by_mes_id')->nullable()->after('issued_by_accounting_id')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('uploaded_at')->nullable()->after('uploaded_by_mes_id');
        });
    }

    public function down(): void
    {
        Schema::table('disposal_jevs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('uploaded_by_mes_id');
            $table->dropColumn('uploaded_at');
        });
    }
};