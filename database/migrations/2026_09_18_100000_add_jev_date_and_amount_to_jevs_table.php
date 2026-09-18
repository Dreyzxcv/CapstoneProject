<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jevs', function (Blueprint $table) {
            $table->date('jev_date')->nullable()->after('jev_number');
            $table->decimal('amount', 15, 2)->nullable()->after('particulars');
        });
    }

    public function down(): void
    {
        Schema::table('jevs', function (Blueprint $table) {
            $table->dropColumn(['jev_date', 'amount']);
        });
    }
};