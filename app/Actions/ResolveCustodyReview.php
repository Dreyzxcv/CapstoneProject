<?php

namespace App\Actions;

use App\Enums\AssetStatus;
use App\Models\Asset;
use App\Models\AssetCaseStatusHistory;
use App\Models\User;
use App\Services\AssetLifecycleService;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Auth;

class ResolveCustodyReview
{
    public function __construct(
        private NotificationService $notifications,
        private AssetLifecycleService $lifecycle,
    ) {}

    public function execute(Asset $asset, string $decision, ?string $remarks = null): void
    {
        $actor = Auth::user();

        // Always persist the review fields first
        $asset->update([
            'custody_review_status'  => $decision,
            'custody_review_remarks' => $remarks,
        ]);

        if ($decision === 'approved') {
            // Use lifecycle so a history row is written automatically
            $this->lifecycle->transition(
                $asset,
                AssetStatus::ReceiptSigned,
                $actor,
                'Custody review approved by Property Custodian'
                    . ($remarks ? ": {$remarks}" : '.'),
                'asset.custody_review_approved',
            );
        }

        if ($decision === 'returned') {
            // Write a history note without changing the status
            // (MES stays on DocumentsUploaded so they can re-submit)
            $asset->update(['current_status' => AssetStatus::DocumentsUploaded]);

            AssetCaseStatusHistory::create([
                'asset_id'   => $asset->id,
                'status'     => AssetStatus::DocumentsUploaded,
                'changed_by' => $actor->id,
                'notes'      => 'Custody review returned for revision by Property Custodian'
                    . ($remarks ? ": {$remarks}" : '.'),
                'changed_at' => now(),
            ]);
        }

        // Notify the submitter
        $submitter = User::find($asset->custody_review_submitted_by);
        if ($submitter) {
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
            );
        }
    }
}