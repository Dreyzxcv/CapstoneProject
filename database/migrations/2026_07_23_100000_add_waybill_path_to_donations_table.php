<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('donations', function (Blueprint $table) {
            $table->string('waybill_pdf_path')->nullable()->after('release_photo_path');
        });
    }

    public function down(): void
    {
        Schema::table('donations', function (Blueprint $table) {
            $table->dropColumn('waybill_pdf_path');
        });
    }
};