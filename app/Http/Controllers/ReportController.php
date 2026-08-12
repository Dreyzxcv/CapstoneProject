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
use App\Enums\AssetMode;
use App\Enums\Municipality;

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

        $chartMonth = $request->input('month', 'all');
        $chartYear = $request->input('year', 'all');

        $chartQuery = Asset::query();
        if ($chartYear !== 'all' && $chartYear !== null && $chartYear !== '') {
            $chartQuery->whereYear('created_at', (int) $chartYear);
        }
        if ($chartMonth !== 'all' && $chartMonth !== null && $chartMonth !== '') {
            $chartQuery->whereMonth('created_at', (int) $chartMonth + 1);
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

        $availableChartYears = Asset::query()
            ->pluck('created_at')
            ->map(fn ($date) => $date->year)
            ->unique()
            ->sortDesc()
            ->values();

        return Inertia::render('Reports/Index', [
            'summary' => [
                'total' => Asset::count(),
                'inStorage' => Asset::where('current_status', AssetStatus::Stored)->count(),
                'forDisposal' => Asset::where('current_status', AssetStatus::ForDisposal)->count(),
                'underTrial' => Asset::where('current_status', AssetStatus::UnderTrial)->count(),
            ],
            'byType' => (clone $chartQuery)
                ->selectRaw('type, count(*) as count')
                ->groupBy('type')
                ->get()
                ->map(fn ($row) => [
                    'type' => $row->type instanceof AssetType ? $row->type->value : $row->type,
                    'label' => $typeLabels[$row->type instanceof AssetType ? $row->type->value : $row->type] ?? $row->type,
                    'count' => $row->count,
                ]),
            'byMunicipality' => (clone $chartQuery)
                ->selectRaw('municipality_of_origin, count(*) as count')
                ->groupBy('municipality_of_origin')
                ->orderByDesc('count')
                ->limit(10)
                ->get(),
            'trends' => $this->buildMonthlyTrends($baseQuery, $trendMonths),
            'trendMonths' => $trendMonths,
            'chartFilters' => ['month' => $chartMonth, 'year' => $chartYear],
            'availableChartYears' => $availableChartYears,
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

    private function buildMonthlyTrends(Builder $baseQuery, int $months): array
    {
        $start = now()->subMonths($months - 1)->startOfMonth();

        $assets = (clone $baseQuery)
            ->where('created_at', '>=', $start)
            ->get(['created_at', 'type']);

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

    public function attributeTable(Request $request): Response
    {
        $this->authorize('viewAny', Asset::class);

        $columns = $this->attributeColumns();
        $clauses = $this->parseClauses($request->input('clauses', []), $columns);
        $combinator = $request->input('combinator') === 'or' ? 'or' : 'and';

        $sortColumn = $request->input('sort', 'id');
        if (! array_key_exists($sortColumn, $columns)) {
            $sortColumn = 'id';
        }
        $sortDirection = $request->input('direction') === 'asc' ? 'asc' : 'desc';

        $assets = $this->buildAttributeQuery($clauses, $combinator)
            ->orderBy($sortColumn, $sortDirection)
            ->paginate(50)
            ->withQueryString();

        return Inertia::render('Reports/AttributeTable', [
            'assets' => $assets,
            'columns' => array_values($columns),
            'filters' => [
                'clauses' => $clauses,
                'combinator' => $combinator,
                'sort' => $sortColumn,
                'direction' => $sortDirection,
            ],
            'resultCount' => $assets->total(),
        ]);
    }

    public function attributeTableExport(Request $request): StreamedResponse
    {
        $this->authorize('viewAny', Asset::class);

        $columns = $this->attributeColumns();
        $clauses = $this->parseClauses($request->input('clauses', []), $columns);
        $combinator = $request->input('combinator') === 'or' ? 'or' : 'and';

        $assets = $this->buildAttributeQuery($clauses, $combinator)->orderBy('id')->get();

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="attribute-table-'.now()->format('Y-m-d').'.csv"',
        ];

        return HttpResponse::stream(function () use ($assets, $columns) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, array_map(fn ($c) => $c['label'], $columns));

            foreach ($assets as $asset) {
                fputcsv($handle, array_map(function ($key) use ($asset) {
                    $value = $asset->{$key};
                    if (is_bool($value)) return $value ? 'Yes' : 'No';
                    if ($value instanceof \Illuminate\Support\Carbon) return $value->toDateTimeString();
                    if (is_object($value) && method_exists($value, 'value')) return $value->value; // enum casts
                    return $value;
                }, array_keys($columns)));
            }

            fclose($handle);
        }, 200, $headers);
    }

    /**
     * Whitelisted, typed column metadata — this is the ONLY set of fields
     * the query builder is allowed to touch. Never accept a raw column
     * name from the client.
     */
    protected function attributeColumns(): array
    {
        return [
            'id' => ['key' => 'id', 'label' => 'ID', 'type' => 'number'],
            'asset_code' => ['key' => 'asset_code', 'label' => 'Asset Code', 'type' => 'text'],
            'aap_number' => ['key' => 'aap_number', 'label' => 'AAP No.', 'type' => 'text'],
            'type' => ['key' => 'type', 'label' => 'Type', 'type' => 'select',
                'options' => collect(AssetType::cases())->map(fn ($t) => ['value' => $t->value, 'label' => $t->label()])],
            'species' => ['key' => 'species', 'label' => 'Species', 'type' => 'text'],
            'description' => ['key' => 'description', 'label' => 'Description', 'type' => 'text'],
            'quantity' => ['key' => 'quantity', 'label' => 'Quantity', 'type' => 'number'],
            'quantity_unit' => ['key' => 'quantity_unit', 'label' => 'Unit', 'type' => 'text'],
            'disposed_quantity' => ['key' => 'disposed_quantity', 'label' => 'Disposed Qty', 'type' => 'number'],
            'volume_bd_ft' => ['key' => 'volume_bd_ft', 'label' => 'Volume (bd.ft)', 'type' => 'number'],
            'volume_cu_m' => ['key' => 'volume_cu_m', 'label' => 'Volume (cu.m)', 'type' => 'number'],
            'estimated_value' => ['key' => 'estimated_value', 'label' => 'Estimated Value', 'type' => 'number'],
            'plate_number' => ['key' => 'plate_number', 'label' => 'Plate Number', 'type' => 'text'],
            'municipality_of_origin' => ['key' => 'municipality_of_origin', 'label' => 'Municipality', 'type' => 'select',
                'options' => collect(Municipality::cases())->map(fn ($m) => ['value' => $m->value, 'label' => $m->value])],
            'location_apprehended' => ['key' => 'location_apprehended', 'label' => 'Location Apprehended', 'type' => 'text'],
            'apprehending_agency' => ['key' => 'apprehending_agency', 'label' => 'Apprehending Agency', 'type' => 'text'],
            'mode' => ['key' => 'mode', 'label' => 'Mode', 'type' => 'select',
                'options' => collect(AssetMode::cases())->map(fn ($m) => ['value' => $m->value, 'label' => $m->label()])],
            'has_ongoing_case' => ['key' => 'has_ongoing_case', 'label' => 'Ongoing Case', 'type' => 'boolean'],
            'has_confiscation_order' => ['key' => 'has_confiscation_order', 'label' => 'Confiscation Order', 'type' => 'boolean'],
            'current_status' => ['key' => 'current_status', 'label' => 'Status', 'type' => 'select',
                'options' => collect(AssetStatus::cases())->map(fn ($s) => ['value' => $s->value, 'label' => $s->label()])],
            'case_number' => ['key' => 'case_number', 'label' => 'Case Number', 'type' => 'text'],
            'court_branch' => ['key' => 'court_branch', 'label' => 'Court / Branch', 'type' => 'text'],
            'next_hearing_date' => ['key' => 'next_hearing_date', 'label' => 'Next Hearing Date', 'type' => 'date'],
            'appeal_deadline' => ['key' => 'appeal_deadline', 'label' => 'Appeal Deadline', 'type' => 'date'],
            'created_at' => ['key' => 'created_at', 'label' => 'Date Created', 'type' => 'date'],
        ];
    }

    protected function operatorsFor(string $type): array
    {
        return match ($type) {
            'number' => ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'null', 'not_null'],
            'date' => ['eq', 'gt', 'lt', 'gte', 'lte', 'null', 'not_null'],
            'boolean' => ['eq'],
            'select' => ['eq', 'neq', 'null', 'not_null'],
            default => ['eq', 'neq', 'contains', 'starts_with', 'null', 'not_null'],
        };
    }

    /**
     * Validates raw clause input against the column/operator whitelist and
     * drops anything that doesn't pass — the query builder never sees
     * unvalidated field names or operators.
     */
    protected function parseClauses(mixed $rawClauses, array $columns): array
    {
        if (! is_array($rawClauses)) {
            return [];
        }

        $clauses = [];

        foreach ($rawClauses as $raw) {
            if (! is_array($raw)) continue;

            $field = $raw['field'] ?? null;
            $operator = $raw['operator'] ?? null;
            $value = $raw['value'] ?? null;

            if (! isset($columns[$field])) continue;
            if (! in_array($operator, $this->operatorsFor($columns[$field]['type']), true)) continue;
            if (! in_array($operator, ['null', 'not_null'], true) && ($value === null || $value === '')) continue;

            $clauses[] = ['field' => $field, 'operator' => $operator, 'value' => $value];
        }

        return $clauses;
    }

    protected function buildAttributeQuery(array $clauses, string $combinator): Builder
    {
        $query = Asset::query();

        if (empty($clauses)) {
            return $query;
        }

        $query->where(function (Builder $q) use ($clauses, $combinator) {
            foreach ($clauses as $i => $clause) {
                $boolean = $i === 0 ? 'and' : $combinator;
                $q->where(function (Builder $inner) use ($clause) {
                    $this->applyClause($inner, $clause);
                }, null, null, $boolean);
            }
        });

        return $query;
    }

    protected function applyClause(Builder $query, array $clause): void
    {
        $field = $clause['field'];
        $operator = $clause['operator'];
        $value = $clause['value'];

        match ($operator) {
            'eq' => $query->where($field, '=', $this->castBoolIfNeeded($field, $value)),
            'neq' => $query->where($field, '!=', $this->castBoolIfNeeded($field, $value)),
            'gt' => $query->where($field, '>', $value),
            'lt' => $query->where($field, '<', $value),
            'gte' => $query->where($field, '>=', $value),
            'lte' => $query->where($field, '<=', $value),
            'contains' => $query->where($field, 'like', "%{$value}%"),
            'starts_with' => $query->where($field, 'like', "{$value}%"),
            'null' => $query->whereNull($field),
            'not_null' => $query->whereNotNull($field),
            default => null,
        };
    }

    protected function castBoolIfNeeded(string $field, mixed $value): mixed
    {
        if (in_array($field, ['has_ongoing_case', 'has_confiscation_order'], true)) {
            return filter_var($value, FILTER_VALIDATE_BOOLEAN);
        }

        return $value;
    }
}