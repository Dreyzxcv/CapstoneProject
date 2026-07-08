<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->foreignId('incident_id')->nullable()->after('id')
                ->constrained()->nullOnDelete();
            $table->unsignedInteger('quantity')->default(1)->after('description');
            $table->decimal('volume_bd_ft', 12, 2)->nullable()->after('quantity');
            $table->decimal('volume_cu_m', 12, 4)->nullable()->after('volume_bd_ft');
            $table->decimal('estimated_value', 14, 2)->nullable()->after('volume_cu_m');
            $table->string('plate_number')->nullable()->after('estimated_value');

            $table->index('incident_id');
        });
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('incident_id');
            $table->dropColumn(['quantity', 'volume_bd_ft', 'volume_cu_m', 'estimated_value', 'plate_number']);
        });
    }
};