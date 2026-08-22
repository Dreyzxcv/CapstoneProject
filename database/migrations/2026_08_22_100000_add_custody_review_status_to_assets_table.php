// database/migrations/2026_08_22_100000_add_custody_review_status_to_assets_table.php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->string('custody_review_status')->nullable()->after('mode'); 
            // null = not submitted, 'pending' = submitted, 'approved', 'returned'
            $table->timestamp('custody_review_submitted_at')->nullable();
            $table->foreignId('custody_review_submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('custody_review_remarks')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn([
                'custody_review_status',
                'custody_review_submitted_at',
                'custody_review_submitted_by',
                'custody_review_remarks',
            ]);
        });
    }
};