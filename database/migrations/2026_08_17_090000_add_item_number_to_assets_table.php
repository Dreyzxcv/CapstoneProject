// database/migrations/2026_08_17_090000_add_item_number_to_assets_table.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            // Position of an item within its incident (1, 2, 3...). Items
            // recorded together in one incident submission now share the
            // same asset_code — this is what tells them apart.
            $table->unsignedInteger('item_number')->default(1)->after('asset_code');
        });

        Schema::table('assets', function (Blueprint $table) {
            // asset_code is no longer unique on its own — every item in the
            // same incident intentionally shares one code now.
            $table->dropUnique(['asset_code']);
        });
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn('item_number');
        });

        Schema::table('assets', function (Blueprint $table) {
            $table->unique('asset_code');
        });
    }
};