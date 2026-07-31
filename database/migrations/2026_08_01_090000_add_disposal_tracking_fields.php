<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            // Cumulative amounts disposed so far. The original quantity/
            // volume_bd_ft/volume_cu_m columns become immutable "as
            // apprehended" figures and are never touched again after intake.
            $table->unsignedInteger('disposed_quantity')->default(0)->after('quantity');
            $table->decimal('disposed_volume_bd_ft', 12, 2)->default(0)->after('volume_bd_ft');
            $table->decimal('disposed_volume_cu_m', 12, 4)->default(0)->after('volume_cu_m');
        });

        Schema::table('disposals', function (Blueprint $table) {
            // How much of the asset THIS disposal event covers. Previously
            // this was implicit (asset->quantity was overwritten); now the
            // asset can have several disposal rows over time.
            $table->unsignedInteger('quantity')->default(1)->after('disposal_type');
            $table->decimal('volume_bd_ft', 12, 2)->nullable()->after('quantity');
        });
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn(['disposed_quantity', 'disposed_volume_bd_ft', 'disposed_volume_cu_m']);
        });

        Schema::table('disposals', function (Blueprint $table) {
            $table->dropColumn(['quantity', 'volume_bd_ft']);
        });
    }
};