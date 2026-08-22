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
        // $decision: 'approved' | 'returned'
        $asset->update([
            'custody_review_status'  => $decision,
            'custody_review_remarks' => $remarks,
        ]);

        // Notify the submitter
        $submitter = User::find($asset->custody_review_submitted_by);
        if ($submitter) {
            $verb    = $decision === 'approved' ? 'approved' : 'returned for revision';
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
            );
        }
    }
}