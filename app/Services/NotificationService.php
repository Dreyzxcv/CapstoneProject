<?php

namespace App\Services;

use App\Enums\AssetStatus;
use App\Models\Asset;
use App\Models\Notification;
use App\Models\User;

class NotificationService
{
    /**
     * Maps a resulting AssetStatus to the role(s) whose turn it is to act
     * next, plus the headline shown in the notification.
     */
    protected function recipientsMap(): array
    {
        return [
            AssetStatus::PendingCustodyReview->value => [
                'roles' => ['Property Custodian'],
                'title' => 'New asset awaiting custody review',
            ],
            AssetStatus::ClearedForAccounting->value => [
                'roles' => ['Accounting Officer'],
                'title' => 'Asset cleared for accounting',
            ],
            AssetStatus::ForDisposal->value => [
                'roles' => ['Accounting Officer'],
                'title' => 'Asset ready for disposal processing',
            ],
            AssetStatus::UnderTrial->value => [
                'roles' => ['MES Officer'],
                'title' => 'Asset held under trial',
            ],
            AssetStatus::PendingRelease->value => [
                'roles' => ['Accounting Officer'],
                'title' => 'Donation awaiting release confirmation',
            ],
        ];
    }

    /**
     * Called from AssetLifecycleService::transition() for every status
     * change. Looks up who should act next for the new status and notifies
     * every user holding that role (except the person who just triggered it).
     */
    public function notifyForTransition(Asset $asset, AssetStatus $to, ?User $actor = null): void
    {
        $config = $this->recipientsMap()[$to->value] ?? null;

        if (! $config) {
            return;
        }

        $this->notifyRoles(
            $asset,
            $config['roles'],
            $config['title'],
            "{$asset->asset_code} is now \"{$to->label()}\" and needs your attention.",
            $actor,
            $to->value,
        );
    }

    /**
     * General-purpose role notification for handoffs that aren't a status
     * transition (e.g. "JEV issued, please upload").
     */
    public function notifyRoles(
        Asset $asset,
        array $roles,
        string $title,
        string $message,
        ?User $actor = null,
        ?string $status = null,
    ): void {
        $recipients = User::role($roles)->get();

        foreach ($recipients as $recipient) {
            if ($actor && $recipient->id === $actor->id) {
                continue;
            }

            Notification::create([
                'user_id' => $recipient->id,
                'asset_id' => $asset->id,
                'title' => $title,
                'message' => $message,
                'status' => $status,
            ]);
        }
    }
}