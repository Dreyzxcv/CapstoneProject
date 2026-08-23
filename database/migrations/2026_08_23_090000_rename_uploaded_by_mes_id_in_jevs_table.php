<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jevs', function (Blueprint $table) {
            $table->renameColumn('uploaded_by_mes_id', 'uploaded_by_accounting_id');
        });
    }

    public function down(): void
    {
        Schema::table('jevs', function (Blueprint $table) {
            $table->renameColumn('uploaded_by_accounting_id', 'uploaded_by_mes_id');
        });
    }
};