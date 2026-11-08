<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $this->renameStatus('receipt_signed', 'documents_verified');
    }

    public function down(): void
    {
        $this->renameStatus('documents_verified', 'receipt_signed');
    }

    private function renameStatus(string $from, string $to): void
    {
        DB::table('assets')->where('current_status', $from)->update(['current_status' => $to]);
        DB::table('asset_case_status_history')->where('status', $from)->update(['status' => $to]);
        DB::table('qr_scans')->where('resulting_status', $from)->update(['resulting_status' => $to]);
        DB::table('notifications')->where('status', $from)->update(['status' => $to]);
    }
};
