<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;
use App\Models\Asset;
use App\Models\Donation;
use App\Enums\AssetStatus;
use App\Enums\DisposalType;
use Illuminate\Support\Facades\DB;

class SidebarTaskCountService
{
    public function countsFor(User $user): array
    {
        try {
            return [
                'assets'    => $this->assetCount($user),
                'jev'       => $this->jevCount($user),
                'disposals' => $this->disposalCount($user),
            ];
        } catch (\Throwable) {
            return ['assets' => 0, 'jev' => 0, 'disposals' => 0];
        }
    }

    private function assetCount(User $user): int
    {
        // Statuses that count as an "asset" action for each role
        $statusesByPermission = [
            // Property Custodian -- needs to review custody submissions
            'assets.mark_stored'   => [
                AssetStatus::PendingCustodyReview->value,
                AssetStatus::ReceiptSigned->value,
            ],
            'documents.verify'     => [
                AssetStatus::PendingCustodyReview->value,
            ],
            // MES Officer -- needs to act after custody returned/approved
            'assets.submit_custody_review' => [
                AssetStatus::Stored->value,
                AssetStatus::DocumentsUploaded->value,
                AssetStatus::IntakeRecorded->value,
            ],
        ];

        $relevantStatuses = collect();

        foreach ($statusesByPermission as $permission => $statuses) {
            if ($user->can($permission)) {
                $relevantStatuses = $relevantStatuses->merge($statuses);
            }
        }

        if ($relevantStatuses->isEmpty()) {
            return 0;
        }

        // Count unread notifications whose status maps to an actionable state
        // for this user — this keeps the badge in sync with the bell.
        return Notification::where('user_id', $user->id)
            ->whereNull('read_at')
            ->whereIn('status', $relevantStatuses->unique()->values()->all())
            ->count();
    }

    private function jevCount(User $user): int
    {
        if (! $user->can('jev.create')) {
            return 0;
        }

        try {
            $pendingJevAssets = Asset::query()
                ->where('current_status', AssetStatus::ClearedForAccounting->value)
                ->whereNotExists(function ($query) {
                    $query->selectRaw('1')
                        ->from('jevs')
                        ->whereColumn('jevs.asset_code', 'assets.asset_code')
                        ->whereColumn('jevs.asset_type', 'assets.type');
                })
                ->select(['assets.asset_code', 'assets.type'])
                ->groupBy('assets.asset_code', 'assets.type');

            $pendingJevIn = DB::query()
                ->fromSub($pendingJevAssets, 'pending_jev_assets')
                ->count();

            $pendingJevOut = Donation::query()
                ->whereNull('released_at')
                ->whereHas('disposals', fn ($q) => $q
                    ->where('disposal_type', DisposalType::Donation->value)
                    ->whereHas('disposalJev', fn ($q) => $q->whereNotNull('uploaded_at'))
                )
                ->count();

            return $pendingJevIn + $pendingJevOut;
        } catch (\Throwable) {
            return 0;
        }
    }

    private function disposalCount(User $user): int
    {
        if (! $user->can('disposals.process')) {
            return 0;
        }

        try {
            // Use unread notifications for disposal actions too
            return Notification::where('user_id', $user->id)
                ->whereNull('read_at')
                ->whereIn('status', [
                    AssetStatus::ForDisposal->value,
                    AssetStatus::PendingRelease->value,
                ])
                ->count();
        } catch (\Throwable) {
            return 0;
        }
    }
}