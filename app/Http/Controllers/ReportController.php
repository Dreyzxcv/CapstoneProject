<?php

namespace App\Http\Controllers;

use App\Enums\AssetStatus;
use App\Enums\AssetType;
use App\Models\Asset;
use App\Models\AssetCaseStatusHistory;
use App\Models\AuditLog;
use App\Services\PdfDocumentService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Response as HttpResponse;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use App\Models\Incident;

class ReportController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', Asset::class);

        $baseQuery = Asset::query();

        $trendMonths = (int) $request->integer('months', 6);
        if (! in_array($trendMonths, [3, 6, 12], true)) {
            $trendMonths = 6;
        }

        $typeLabels = collect(AssetType::cases())->mapWithKeys(
            fn ($t) => [$t->value => $t->label()]
        );

        $recentActivity = AssetCaseStatusHistory::query()
            ->with(['asset', 'changedBy'])
            ->latest('changed_at')
            ->limit(10)
            ->get();

        $statusLabels = collect(AssetStatus::cases())->mapWithKeys(
            fn ($s) => [$s->value => $s->label()]
        );

        $incidentLocations = Incident::query()
            ->whereNotNull('coordinates')
            ->withCount('assets')
            ->latest('date_of_apprehension')
            ->limit(300)
            ->get(['id', 'incident_code', 'coordinates', 'place_of_apprehension', 'date_of_apprehension', 'is_abandoned'])
            ->map(fn (Incident $incident) => [
                'id' => $incident->id,
                'incident_code' => $incident->incident_code,
                'coordinates' => $incident->coordinates,
                'place_of_apprehension' => $incident->place_of_apprehension,
                'date_of_apprehension' => $incident->date_of_apprehension?->toDateString(),
                'is_abandoned' => $incident->is_abandoned,
                'asset_count' => $incident->assets_count,
                'asset_ids' => $incident->assets->pluck('id'),
                'asset_types' => $incident->assets->pluck('type')->map(fn ($t) => $t->value)->unique()->values(),
            ]);

        return Inertia::render('Reports/Index', [
            'summary' => [
                'total' => Asset::count(),
                'inStorage' => Asset::where('current_status', AssetStatus::Stored)->count(),
                'forDisposal' => Asset::where('current_status', AssetStatus::ForDisposal)->count(),
                'underTrial' => Asset::where('current_status', AssetStatus::UnderTrial)->count(),
            ],
            'byType' => (clone $baseQuery)
                ->selectRaw('type, count(*) as count')
                ->groupBy('type')
                ->get()
                ->map(fn ($row) => [
                    'type' => $row->type instanceof AssetType ? $row->type->value : $row->type,
                    'label' => $typeLabels[$row->type instanceof AssetType ? $row->type->value : $row->type] ?? $row->type,
                    'count' => $row->count,
                ]),
            'byMunicipality' => (clone $baseQuery)
                ->selectRaw('municipality_of_origin, count(*) as count')
                ->groupBy('municipality_of_origin')
                ->orderByDesc('count')
                ->limit(10)
                ->get(),
            'trends' => $this->buildMonthlyTrends($baseQuery, $trendMonths),
            'trendMonths' => $trendMonths,
            'typeLabels' => $typeLabels,
            'statusLabels' => $statusLabels,
            'recentActivity' => $recentActivity,
            'incidentLocations' => $incidentLocations,
            'can' => [
                'export' => $request->user()?->can('reports.export') ?? false,
                'viewAudit' => $request->user()?->can('viewAny', AuditLog::class) ?? false,
            ],
        ]);
    }

    /**
     * Build a month-by-month confiscation count broken down by asset type,
     * covering the last $months months (including the current month).
     * Done in PHP rather than a DB-specific date-grouping query so it
     * works identically on MySQL (production) and SQLite (tests).
     */
    private function buildMonthlyTrends(Builder $baseQuery, int $months): array
    {
        $start = now()->subMonths($months - 1)->startOfMonth();

        $assets = (clone $baseQuery)
            ->where('created_at', '>=', $start)
            ->get(['created_at', 'type']);

        // Plain array, not a Collection — we need real in-place ++ mutation
        // below, and Collection's ArrayAccess doesn't support indirect
        // modification of nested elements (offsetGet returns by value).
        $buckets = [];
        for ($i = 0; $i < $months; $i++) {
            $period = $start->copy()->addMonths($i);
            $key = $period->format('Y-m');
            $buckets[$key] = [
                'key' => $key,
                'month' => $period->format('M Y'),
                'log' => 0,
                'equipment' => 0,
                'vehicle' => 0,
                'total' => 0,
            ];
        }

        foreach ($assets as $asset) {
            $key = $asset->created_at->format('Y-m');

            if (! isset($buckets[$key])) {
                continue;
            }

            $type = $asset->type instanceof AssetType ? $asset->type->value : $asset->type;

            if (isset($buckets[$key][$type])) {
                $buckets[$key][$type]++;
            }

            $buckets[$key]['total']++;
        }

        return array_values($buckets);
    }

    public function inventory(Request $request): StreamedResponse
    {
        abort_unless($request->user()?->can('reports.export'), 403);

        $assets = Asset::with(['creator', 'acknowledgementReceipt'])->get();

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="inventory-'.now()->format('Y-m-d').'.csv"',
        ];

        return HttpResponse::stream(function () use ($assets) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'Asset Code', 'Type', 'Species', 'Municipality', 'Status', 'Mode', 'Created At',
            ]);

            foreach ($assets as $asset) {
                fputcsv($handle, [
                    $asset->asset_code,
                    $asset->type->label(),
                    $asset->species,
                    $asset->municipality_of_origin,
                    $asset->current_status->label(),
                    $asset->mode->label(),
                    $asset->created_at->toDateTimeString(),
                ]);
            }

            fclose($handle);
        }, 200, $headers);
    }

    public function compliance(Request $request, PdfDocumentService $pdfService): \Illuminate\Http\Response
    {
        abort_unless($request->user()?->can('reports.export'), 403);

        $data = [
            'generatedAt' => now(),
            'byMunicipality' => Asset::query()
                ->selectRaw('municipality_of_origin, count(*) as count')
                ->groupBy('municipality_of_origin')
                ->orderBy('municipality_of_origin')
                ->get(),
            'byType' => Asset::query()
                ->selectRaw('type, count(*) as count')
                ->groupBy('type')
                ->get()
                ->map(fn ($row) => [
                    'type' => $row->type->label(),
                    'count' => $row->count,
                ]),
            'byStatus' => Asset::query()
                ->selectRaw('current_status, count(*) as count')
                ->groupBy('current_status')
                ->get()
                ->map(fn ($row) => [
                    'status' => $row->current_status->label(),
                    'count' => $row->count,
                ]),
        ];

        $path = $pdfService->generateComplianceReport($data);
        $content = \Illuminate\Support\Facades\Storage::disk('local')->get($path);

        return response($content, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="compliance-report-'.now()->format('Y-m-d').'.pdf"',
        ]);
    }

    public function auditLogs(Request $request): Response
    {
        $this->authorize('viewAny', AuditLog::class);

        $logs = AuditLog::query()
            ->with('user')
            ->latest('created_at')
            ->paginate(25);

        return Inertia::render('Reports/AuditLogs', [
            'logs' => $logs,
        ]);
    }
}