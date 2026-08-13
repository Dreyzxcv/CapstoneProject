<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_pieces', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('piece_number');
            $table->string('qr_code_token', 64)->unique();
            $table->timestamps();

            $table->unique(['asset_id', 'piece_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_pieces');
    }
};
