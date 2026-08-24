<?php
namespace App\Actions;

use App\Models\Asset;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Auth;

class SubmitAapForReview
{
    public function __construct(private NotificationService $notifications) {}

    public function execute(Asset $asset): void
    {
        $asset->update([
            'aap_review_requested'    => true,
            'aap_review_requested_at' => now(),
        ]);

        $custodians = User::role('Property Custodian')->where('is_active', true)->get();

        foreach ($custodians as $custodian) {
            $this->notifications->notify(
                user: $custodian,
                title: 'AAP Document Ready for Verification',
                message: sprintf(
                    '%s uploaded the AAP Scanned Document for Asset %s (AAP No. %s). Please verify it.',
                    Auth::user()->name,
                    $asset->asset_code,
                    $asset->aap_number,
                ),
                link: route('assets.show', $asset),
                type: 'custody_review',
                assetId: $asset->id,
            );
        }
    }
}