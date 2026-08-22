<?php
namespace App\Actions;

use App\Models\Asset;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Auth;
use Spatie\Permission\Models\Role;

class SubmitForCustodyReview
{
    public function __construct(private NotificationService $notifications) {}

    public function execute(Asset $asset): void
    {
        // Mark asset as pending review
        $asset->update([
            'custody_review_status'       => 'pending',
            'custody_review_submitted_at' => now(),
            'custody_review_submitted_by' => Auth::id(),
            'custody_review_remarks'      => null,
        ]);

        // Notify all custodians
        $custodians = User::role('Property Custodian')->where('is_active', true)->get();

        foreach ($custodians as $custodian) {
            $this->notifications->notify(
                user: $custodian,
                title: 'Custody Review Requested',
                message: sprintf(
                    '%s submitted Asset %s for custody review. Please check the uploaded documents.',
                    Auth::user()->name,
                    $asset->asset_code
                ),
                link: route('assets.show', $asset),
                type: 'custody_review',
                assetId: $asset->id,
            );
        }
    }
}