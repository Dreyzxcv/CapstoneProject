<?php

namespace App\Http\Controllers;

use App\Enums\AssetStatus;
use App\Enums\AssetType;
use App\Models\Asset;
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
        ];

        $statusLabels = collect(AssetStatus::cases())->mapWithKeys(
            fn ($s) => [$s->value => $s->label()]
        );

        $typeLabels = collect(AssetType::cases())->mapWithKeys(
            fn ($t) => [$t->value => $t->label()]
        );

        return Inertia::render('Dashboard/Index', [
            'stats' => $stats,
            'statusLabels' => $statusLabels,
            'typeLabels' => $typeLabels,
            'roleContext' => $this->buildRoleContext($user, $baseQuery),
            'canViewAudit' => $user->can('viewAny', AuditLog::class),
            'alerts' => $alertService->generate(),
        ]);
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

        $deltaByStatuses = fn (array $statuses) => (clone $baseQuery)
            ->whereIn('current_status', $statuses)
            ->where('created_at', '>=', now()->subDays(7))
            ->count();

        $activeStatuses = [
            AssetStatus::IntakeRecorded->value,
            AssetStatus::PendingCustodyReview->value,
            AssetStatus::ReceiptSigned->value,
            AssetStatus::Stored->value,
            AssetStatus::UnderTrial->value,
            AssetStatus::ClearedForAccounting->value,
            AssetStatus::ForDisposal->value,
        ];

        $disposedStatuses = [
            AssetStatus::Donated->value,
            AssetStatus::Decayed->value,
            AssetStatus::Fabricated->value,
            AssetStatus::Released->value,
            AssetStatus::Forfeited->value,
            AssetStatus::Damaged->value,
        ];

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
                        'label' => 'Stored',
                        'value' => $countByStatuses([AssetStatus::Stored->value]),
                        'description' => 'Intake completed and assets placed in storage',
                    ],
                    [
                        'label' => 'Custody review',
                        'value' => $countByStatuses([AssetStatus::PendingCustodyReview->value]),
                        'description' => 'Items waiting for document verification',
                    ],
                    [
                        'label' => 'Document verified',
                        'value' => $countByStatuses([AssetStatus::ReceiptSigned->value]),
                        'description' => 'Documents verified and ready for tagging',
                    ],
                ],
            ],
            'Property Custodian' => [
                'title' => 'Custody Workload',
                'description' => 'Items that need verification, signing, and storage handling',
                'cards' => [
                    [
                        'label' => 'Stored',
                        'value' => $countByStatuses([AssetStatus::Stored->value]),
                        'description' => 'Assets already placed in custody',
                    ],
                    [
                        'label' => 'Pending verification',
                        'value' => $countByStatuses([AssetStatus::PendingCustodyReview->value]),
                        'description' => 'Awaiting custody review and document verification',
                    ],
                    [
                        'label' => 'Tagged',
                        'value' => $countByStatuses([AssetStatus::ReceiptSigned->value]),
                        'description' => 'Assets that have been tagged and ready for accounting',
                    ],
                ],
            ],
            'Accounting Officer' => [
                'title' => 'Accounting Queue',
                'description' => 'Assets moving from custody into accounting and disposal',
                'cards' => [
                    [
                        'label' => 'Cleared for Custodian',
                        'value' => $countByStatuses([AssetStatus::ClearedForAccounting->value]),
                        'description' => 'Assets cleared for custodian and ready for issuing of JEV',
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
                'description' => 'Executive view of the full asset pipeline, compliance health, and disposal outcomes.',
                'cards' => [
                    [
                        'label' => 'Total inventory',
                        'value' => (clone $baseQuery)->count(),
                        'delta' => (clone $baseQuery)->where('created_at', '>=', now()->subDays(7))->count(),
                        'description' => 'All assets ever recorded in the system',
                    ],
                    [
                        'label' => 'Active in pipeline',
                        'value' => $countByStatuses($activeStatuses),
                        'delta' => $deltaByStatuses($activeStatuses),
                        'description' => 'Assets currently moving through workflow stages',
                    ],
                    [
                        'label' => 'Under trial',
                        'value' => $countByStatuses([AssetStatus::UnderTrial->value]),
                        'delta' => $deltaByStatuses([AssetStatus::UnderTrial->value]),
                        'description' => 'Assets held pending legal or court resolution',
                    ],
                    [
                        'label' => 'Disposed',
                        'value' => $countByStatuses($disposedStatuses),
                        'delta' => $deltaByStatuses($disposedStatuses),
                        'description' => 'Cases fully closed out through disposition',
                    ],
                ],
            
                // Pipeline stage breakdown — used by the frontend for bottleneck detection
                'pipeline' => [
                    ['key' => 'stored',                   'label' => 'Stored',            'value' => $countByStatuses([AssetStatus::Stored->value])],
                    ['key' => 'receipt_signed',            'label' => 'Doc Verified',      'value' => $countByStatuses([AssetStatus::ReceiptSigned->value])],
                    ['key' => 'pending_custody_review',    'label' => 'Custody Review',    'value' => $countByStatuses([AssetStatus::PendingCustodyReview->value])],
                    ['key' => 'cleared_for_accounting',    'label' => 'Tagged',            'value' => $countByStatuses([AssetStatus::ClearedForAccounting->value])],
                    ['key' => 'for_disposal',              'label' => 'For Disposal',      'value' => $countByStatuses([AssetStatus::ForDisposal->value])],
                    ['key' => 'under_trial',               'label' => 'Under Trial',       'value' => $countByStatuses([AssetStatus::UnderTrial->value])],
                ],
            
                // Disposition breakdown — used for the outcome summary
                'dispositionBreakdown' => [
                    ['key' => 'donated',     'label' => 'Donated',     'value' => $countByStatuses([AssetStatus::Donated->value])],
                    ['key' => 'released',    'label' => 'Released',    'value' => $countByStatuses([AssetStatus::Released->value])],
                    ['key' => 'forfeited',   'label' => 'Forfeited',   'value' => $countByStatuses([AssetStatus::Forfeited->value])],
                    ['key' => 'decayed',     'label' => 'Decayed',     'value' => $countByStatuses([AssetStatus::Decayed->value])],
                    ['key' => 'fabricated',  'label' => 'Fabricated',  'value' => $countByStatuses([AssetStatus::Fabricated->value])],
                    ['key' => 'damaged',     'label' => 'Damaged',     'value' => $countByStatuses([AssetStatus::Damaged->value])],
                ],
            ],
        };
    }
}