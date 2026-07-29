<?php
// database/migrations/2026_07_29_090000_create_market_prices_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('market_prices', function (Blueprint $table) {
            $table->id();
            $table->string('species');
            $table->unsignedSmallInteger('year');
            $table->decimal('price_per_bd_ft', 10, 4);
            $table->timestamps();

            $table->unique(['species', 'year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('market_prices');
    }
};