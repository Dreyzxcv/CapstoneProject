<?php

namespace App\Http\Controllers;

use App\Enums\AssetStatus;
use App\Enums\AssetType;
use App\Models\Asset;
use App\Models\AssetCaseStatusHistory;
use App\Models\AuditLog;
use App\Services\AssetAlertService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request, AssetAlertService $alertService): Response
    {
        $this->authorize('viewAny', Asset::class);

        $user = $request->user();
        $baseQuery = Asset::query();

        $stats = [
            'total' => (clone $baseQuery)->count(),
            'byType' => (clone $baseQuery)
                ->selectRaw('type, count(*) as count')
                ->groupBy('type')
                ->pluck('count', 'type'),
            'byStatus' => (clone $baseQuery)
                ->selectRaw('current_status, count(*) as count')
                ->groupBy('current_status')
                ->pluck('count', 'current_status'),
            'byMunicipality' => (clone $baseQuery)
                ->selectRaw('municipality_of_origin, count(*) as count')
                ->groupBy('municipality_of_origin')
                ->orderByDesc('count')
                ->limit(10)
                ->get(),
        ];

        $recentActivity = AssetCaseStatusHistory::query()
            ->with(['asset', 'changedBy'])
            ->latest('changed_at')
            ->limit(10)
            ->get();

        $statusLabels = collect(AssetStatus::cases())->mapWithKeys(
            fn ($s) => [$s->value => $s->label()]
        );

        $typeLabels = collect(AssetType::cases())->mapWithKeys(
            fn ($t) => [$t->value => $t->label()]
        );

        $trendMonths = (int) $request->integer('months', 6);
        if (! in_array($trendMonths, [3, 6, 12], true)) {
            $trendMonths = 6;
        }

        return Inertia::render('Dashboard/Index', [
            'stats' => $stats,
            'recentActivity' => $recentActivity,
            'statusLabels' => $statusLabels,
            'typeLabels' => $typeLabels,
            'roleContext' => $this->buildRoleContext($user, $baseQuery),
            'canViewAudit' => $user->can('viewAny', AuditLog::class),
            'trends' => $this->buildMonthlyTrends($baseQuery, $trendMonths),
            'trendMonths' => $trendMonths,
            'alerts' => $alertService->generate(),
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

    private function buildRoleContext($user, Builder $baseQuery): array
    {
        $roleName = $user->getRoleNames()->first() ?? 'Guest';
        $normalizedRole = match ($roleName) {
            'PENRO Management', 'PENRO Supervisor', 'Regional Supervisor' => 'PENRO Management',
            default => $roleName,
        };

        $countByStatuses = fn (array $statuses) => (clone $baseQuery)
            ->whereIn('current_status', $statuses)
            ->count();

        return match ($normalizedRole) {
            'System Admin' => [
                'title' => 'System Administration',
                'description' => 'Full oversight of inventory, workflow, and audit visibility',
                'cards' => [
                    [
                        'label' => 'Active assets',
                        'value' => $countByStatuses([
                            AssetStatus::IntakeRecorded->value,
                            AssetStatus::PendingCustodyReview->value,
                            AssetStatus::ReceiptSigned->value,
                            AssetStatus::Stored->value,
                            AssetStatus::UnderTrial->value,
                            AssetStatus::ClearedForAccounting->value,
                            AssetStatus::ForDisposal->value,
                        ]),
                        'description' => 'Assets currently in active workflow',
                    ],
                    [
                        'label' => 'Completed',
                        'value' => $countByStatuses([
                            AssetStatus::Donated->value,
                            AssetStatus::Decayed->value,
                            AssetStatus::Fabricated->value,
                            AssetStatus::Released->value,
                            AssetStatus::Forfeited->value,
                            AssetStatus::Damaged->value,
                        ]),
                        'description' => 'Assets closed out from active workflow',
                    ],
                    [
                        'label' => 'Total assets',
                        'value' => (clone $baseQuery)->count(),
                        'description' => 'Overall inventory volume',
                    ],
                ],
            ],
            'MES Officer' => [
                'title' => 'MES Intake Queue',
                'description' => 'Assets awaiting intake and custody follow-up',
                'cards' => [
                    [
                        'label' => 'Awaiting intake',
                        'value' => $countByStatuses([AssetStatus::IntakeRecorded->value]),
                        'description' => 'New intake entries captured by MES',
                    ],
                    [
                        'label' => 'Custody review',
                        'value' => $countByStatuses([AssetStatus::PendingCustodyReview->value]),
                        'description' => 'Items waiting for document verification',
                    ],
                    [
                        'label' => 'Receipt signed',
                        'value' => $countByStatuses([AssetStatus::ReceiptSigned->value]),
                        'description' => 'Ready for QR tagging and storage',
                    ],
                ],
            ],
            'Property Custodian' => [
                'title' => 'Custody Workload',
                'description' => 'Items that need verification, signing, and storage handling',
                'cards' => [
                    [
                        'label' => 'Pending signature',
                        'value' => $countByStatuses([AssetStatus::PendingCustodyReview->value]),
                        'description' => 'Awaiting acknowledgement receipt sign-off',
                    ],
                    [
                        'label' => 'Ready for storage',
                        'value' => $countByStatuses([AssetStatus::ReceiptSigned->value]),
                        'description' => 'Signed receipts waiting for storage confirmation',
                    ],
                    [
                        'label' => 'Stored',
                        'value' => $countByStatuses([AssetStatus::Stored->value]),
                        'description' => 'Assets already placed in custody',
                    ],
                ],
            ],
            'Accounting Officer' => [
                'title' => 'Accounting Queue',
                'description' => 'Assets moving from custody into accounting and disposal',
                'cards' => [
                    [
                        'label' => 'Cleared for accounting',
                        'value' => $countByStatuses([AssetStatus::ClearedForAccounting->value]),
                        'description' => 'Cases ready for JEV and accounting action',
                    ],
                    [
                        'label' => 'For disposal',
                        'value' => $countByStatuses([AssetStatus::ForDisposal->value]),
                        'description' => 'Prepared for donation, decay, fabrication, or release',
                    ],
                    [
                        'label' => 'Completed disposals',
                        'value' => $countByStatuses([
                            AssetStatus::Donated->value,
                            AssetStatus::Decayed->value,
                            AssetStatus::Fabricated->value,
                            AssetStatus::Released->value,
                            AssetStatus::Forfeited->value,
                            AssetStatus::Damaged->value,
                        ]),
                        'description' => 'Disposed assets already closed out',
                    ],
                ],
            ],
            'PENRO Management' => [
                'title' => 'Management Overview',
                'description' => 'Executive view of inventory, compliance, and municipality trends',
                'cards' => [
                    [
                        'label' => 'Under trial',
                        'value' => $countByStatuses([AssetStatus::UnderTrial->value]),
                        'description' => 'Assets currently tied to court or legal action',
                    ],
                    [
                        'label' => 'Disposed',
                        'value' => $countByStatuses([
                            AssetStatus::Donated->value,
                            AssetStatus::Decayed->value,
                            AssetStatus::Fabricated->value,
                            AssetStatus::Released->value,
                            AssetStatus::Forfeited->value,
                            AssetStatus::Damaged->value,
                        ]),
                        'description' => 'Completed disposition cases',
                    ],
                    [
                        'label' => 'Stored inventory',
                        'value' => $countByStatuses([AssetStatus::Stored->value]),
                        'description' => 'Active assets on hand in custody',
                    ],
                ],
            ],
            default => [
                'title' => 'Inventory Dashboard',
                'description' => 'Full asset inventory and activity feed',
                'cards' => [
                    [
                        'label' => 'Active assets',
                        'value' => $countByStatuses([
                            AssetStatus::IntakeRecorded->value,
                            AssetStatus::PendingCustodyReview->value,
                            AssetStatus::ReceiptSigned->value,
                            AssetStatus::Stored->value,
                            AssetStatus::UnderTrial->value,
                            AssetStatus::ClearedForAccounting->value,
                            AssetStatus::ForDisposal->value,
                        ]),
                        'description' => 'Assets currently in active workflow',
                    ],
                    [
                        'label' => 'Completed',
                        'value' => $countByStatuses([
                            AssetStatus::Donated->value,
                            AssetStatus::Decayed->value,
                            AssetStatus::Fabricated->value,
                            AssetStatus::Released->value,
                            AssetStatus::Forfeited->value,
                            AssetStatus::Damaged->value,
                        ]),
                        'description' => 'Assets closed out from active workflow',
                    ],
                    [
                        'label' => 'Total assets',
                        'value' => (clone $baseQuery)->count(),
                        'description' => 'Overall inventory volume',
                    ],
                ],
            ],
        };
    }
}