<?php
namespace App\Actions;

use App\Models\Asset;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Auth;

class ResolveCustodyReview
{
    public function __construct(private NotificationService $notifications) {}

    public function execute(Asset $asset, string $decision, ?string $remarks = null): void
    {
        $updates = [
            'custody_review_status'  => $decision,
            'custody_review_remarks' => $remarks,
        ];

        // On approval, advance the status so custodian can mark as tagged
        if ($decision === 'approved') {
            $updates['current_status'] = \App\Enums\AssetStatus::PendingCustodyReview;
        }

        // On return, revert status back so MES can re-upload/re-submit
        if ($decision === 'returned') {
            $updates['current_status'] = \App\Enums\AssetStatus::DocumentsUploaded;
        }

        $asset->update($updates);

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
                    Auth::user()->name,
                    $remarks ? " Remarks: {$remarks}" : ''
                ),
                link: route('assets.show', $asset),
                type: 'custody_review',
                assetId: $asset->id,
            );
        }
    }
}