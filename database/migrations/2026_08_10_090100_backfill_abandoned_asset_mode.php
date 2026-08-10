<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // AssetMode::Abandoned no longer exists — any pre-existing row still
        // carrying the literal string 'abandoned' will fail to cast via the
        // AssetMode enum the moment it's read. Fold those rows into
        // Apprehended + unclaimed, matching the new "Apprehended, without
        // claimant" flow.
        DB::table('assets')
            ->where('mode', 'abandoned')
            ->update(['mode' => 'apprehended']);
    }

    public function down(): void
    {
        // Not reversible — we don't know which apprehended rows were
        // originally abandoned.
    }
};