<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->boolean('aap_review_requested')->default(false)->after('aap_number');
            $table->timestamp('aap_review_requested_at')->nullable()->after('aap_review_requested');
        });
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn(['aap_review_requested', 'aap_review_requested_at']);
        });
    }
};