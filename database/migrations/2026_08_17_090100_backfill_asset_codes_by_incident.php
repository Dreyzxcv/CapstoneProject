// database/migrations/2026_08_17_090100_backfill_asset_codes_by_incident.php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

return new class extends Migration
{
    public function up(): void
    {
        $incidentIds = DB::table('assets')
            ->whereNotNull('incident_id')
            ->distinct()
            ->pluck('incident_id');

        foreach ($incidentIds as $incidentId) {
            $incident = DB::table('incidents')->where('id', $incidentId)->first();
            if (! $incident) {
                continue;
            }

            $assetsInIncident = DB::table('assets')
                ->where('incident_id', $incidentId)
                ->orderBy('id')
                ->get();

            if ($assetsInIncident->isEmpty()) {
                continue;
            }

            $firstAsset = $assetsInIncident->first();

            $year = $incident->date_report_submitted
                ? Carbon::parse($incident->date_report_submitted)->format('Y')
                : Carbon::parse($firstAsset->created_at)->format('Y');

            $prefix = $firstAsset->mode === 'turned_over' ? 'TO' : 'AP';
            $sequence = str_pad((string) $incidentId, 5, '0', STR_PAD_LEFT);
            $newCode = "{$prefix}-{$year}-{$sequence}";

            DB::table('assets')
                ->where('incident_id', $incidentId)
                ->update(['asset_code' => $newCode]);
        }
    }

    public function down(): void
    {
        // Not reversible — the original per-asset codes aren't preserved.
    }
};