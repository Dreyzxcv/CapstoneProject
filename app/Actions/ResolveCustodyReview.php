<?php

namespace App\Actions;

use App\Enums\AssetStatus;
use App\Models\Asset;
use App\Models\AssetCaseStatusHistory;
use App\Models\User;
use App\Services\AssetLifecycleService;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ResolveCustodyReview
{
    public function __construct(
        private NotificationService $notifications,
        private AssetLifecycleService $lifecycle,
    ) {}

    public function execute(Asset $asset, string $decision, ?string $remarks = null, ?User $actor = null): void
    {
        $actor ??= Auth::user();

        if ($decision === 'returned') {
            $this->returnForRevision($asset, $remarks, $actor);
            return;
        }

        $asset->update([
            'custody_review_status'  => $decision,
            'custody_review_remarks' => $remarks,
        ]);

        $this->lifecycle->transition(
            $asset,
            AssetStatus::DocumentsVerified,
            $actor,
            'Custody review approved by Property Custodian. Documents verified.',
            'asset.custody_review_approved',
        );

        Asset::where('asset_code', $asset->asset_code)
            ->where('id', '!=', $asset->id)
            ->update([
                'custody_review_status'  => $decision,
                'custody_review_remarks' => $remarks,
            ]);

        $this->notifySubmitter($asset, 'approved', $remarks, $actor);
    }

    /**
     * Return the asset (and all siblings sharing its asset_code) to MES.
     * Idempotent: does nothing if the review is not currently pending.
     */
    public function returnForRevision(Asset $asset, ?string $remarks, ?User $actor = null): bool
    {
        $actor ??= Auth::user();

        return DB::transaction(function () use ($asset, $remarks, $actor) {
            $fresh = Asset::whereKey($asset->id)->lockForUpdate()->first();

            if ($fresh->custody_review_status !== 'pending') {
                return false; // already returned/approved: no duplicate history or notification
            }

            Asset::where('asset_code', $fresh->asset_code)->update([
                'current_status'         => AssetStatus::DocumentsUploaded,
                'custody_review_status'  => 'returned',
                'custody_review_remarks' => $remarks,
            ]);

            AssetCaseStatusHistory::create([
                'asset_id'   => $fresh->id,
                'status'     => AssetStatus::DocumentsUploaded,
                'changed_by' => $actor->id,
                'notes'      => 'Custody review returned for revision by Property Custodian'
                    . ($remarks ? ": {$remarks}" : '.'),
                'changed_at' => now(),
            ]);

            $this->notifySubmitter($fresh->refresh(), 'returned', $remarks, $actor);

            return true;
        });
    }

    private function notifySubmitter(Asset $asset, string $decision, ?string $remarks, User $actor): void
    {
        $submitter = User::find($asset->custody_review_submitted_by);
        if (! $submitter) {
            return;
        }

        $verb = $decision === 'approved' ? 'approved' : 'returned for revision';
        $this->notifications->notify(
            user: $submitter,
            title: 'Custody Review ' . ucfirst($decision),
            message: sprintf(
                'Asset %s was %s by %s.%s',
                $asset->asset_code,
                $verb,
                $actor->name,
                $remarks ? " Remarks: {$remarks}" : ''
            ),
            link: route('assets.show', $asset),
            type: 'custody_review',
            assetId: $asset->id,
            status: $decision === 'approved'
                ? AssetStatus::DocumentsVerified->value
                : AssetStatus::DocumentsUploaded->value,
        );
    }
}