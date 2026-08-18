<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('asset_pieces', function (Blueprint $table) {
            // Per-piece measurement and identification fields.
            // Each piece in a multi-piece asset (e.g. 10 narra logs of different
            // dimensions) carries its own measurements so MES can encode them 1-by-1.
            $table->string('species', 255)->nullable()->after('piece_number');
            $table->text('description')->nullable()->after('species');
            $table->decimal('length', 10, 2)->nullable()->after('description');
            $table->decimal('width', 10, 2)->nullable()->after('length');
            $table->decimal('height', 10, 2)->nullable()->after('width');
            $table->decimal('volume_bd_ft', 12, 4)->nullable()->after('height');
            $table->decimal('volume_cu_m', 12, 6)->nullable()->after('volume_bd_ft');
            $table->decimal('estimated_value', 14, 2)->nullable()->after('volume_cu_m');
            $table->string('plate_number', 50)->nullable()->after('estimated_value');
        });
    }

    public function down(): void
    {
        Schema::table('asset_pieces', function (Blueprint $table) {
            $table->dropColumn([
                'species',
                'description',
                'length',
                'width',
                'height',
                'volume_bd_ft',
                'volume_cu_m',
                'estimated_value',
                'plate_number',
            ]);
        });
    }
};