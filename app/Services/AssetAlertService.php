<?php

namespace App\Services;

use App\Enums\AssetStatus;
use App\Enums\AssetType;
use App\Models\Asset;
use Illuminate\Support\Collection;

class AssetAlertService
{
    public function generate(): Collection
    {
        return collect()
            ->merge($this->appealDeadlineAlerts())
            ->merge($this->staleDisposalAlerts())
            ->merge($this->stalePendingReviewAlerts())
            ->merge($this->staleJevAlerts())
            ->sortBy('severity_rank')
            ->take(15)
            ->values();
    }

    /**
     * Vehicles whose 15-day appeal window is closing soon or has already
     * closed without a disposal decision (release/forfeiture) yet.
     */
    protected function appealDeadlineAlerts(): Collection
    {
        $upcoming = Asset::query()
            ->where('type', AssetType::Vehicle->value)
            ->whereNotNull('appeal_deadline')
            ->whereDoesntHave('disposal')
            ->where('appeal_deadline', '<=', now()->addDays(3))
            ->get();

        return $upcoming->map(function (Asset $asset) {
            $overdue = $asset->appeal_deadline->isPast();

            return [
                'id' => "appeal-{$asset->id}",
                'severity' => $overdue ? 'critical' : 'warning',
                'severity_rank' => $overdue ? 0 : 1,
                'title' => $overdue ? 'Appeal window closed' : 'Appeal window closing soon',
                'message' => $overdue
                    ? "{$asset->asset_code} — appeal deadline passed on {$asset->appeal_deadline->format('M d, Y')}. Release/forfeiture decision is due."
                    : "{$asset->asset_code} — appeal window closes {$asset->appeal_deadline->diffForHumans()}.",
                'asset_id' => $asset->id,
            ];
        });
    }

    /**
     * Logs that have been sitting in "for disposal" for over 30 days —
     * decay risk if not donated / reported / fabricated soon.
     */
    protected function staleDisposalAlerts(): Collection
    {
        $threshold = now()->subDays(30);

        $stale = Asset::query()
            ->where('type', AssetType::Log->value)
            ->where('current_status', AssetStatus::ForDisposal->value)
            ->whereHas('statusHistory', function ($q) use ($threshold) {
                $q->where('status', AssetStatus::ForDisposal->value)
                    ->where('changed_at', '<=', $threshold);
            })
            ->get();

        return $stale->map(fn (Asset $asset) => [
            'id' => "decay-{$asset->id}",
            'severity' => 'warning',
            'severity_rank' => 1,
            'title' => 'Decay risk',
            'message' => "{$asset->asset_code} has been awaiting disposal for over 30 days — check for decay before further deterioration.",
            'asset_id' => $asset->id,
        ]);
    }

    /**
     * Assets stuck in custody review for more than a week — documentation
     * may be incomplete or the queue is backed up.
     */
    protected function stalePendingReviewAlerts(): Collection
    {
        $threshold = now()->subDays(7);

        $stale = Asset::query()
            ->where('current_status', AssetStatus::PendingCustodyReview->value)
            ->where('created_at', '<=', $threshold)
            ->get();

        return $stale->map(fn (Asset $asset) => [
            'id' => "review-{$asset->id}",
            'severity' => 'info',
            'severity_rank' => 2,
            'title' => 'Custody review overdue',
            'message' => "{$asset->asset_code} has been pending custody review for over 7 days.",
            'asset_id' => $asset->id,
        ]);
    }

    /**
     * JEVs issued by Accounting but not yet uploaded/confirmed by MES.
     */
    protected function staleJevAlerts(): Collection
    {
        $threshold = now()->subDays(10);

        $stale = Asset::query()
            ->whereHas('jev', function ($q) use ($threshold) {
                $q->whereNull('uploaded_at')->where('created_at', '<=', $threshold);
            })
            ->get();

        return $stale->map(fn (Asset $asset) => [
            'id' => "jev-{$asset->id}",
            'severity' => 'info',
            'severity_rank' => 2,
            'title' => 'JEV upload pending',
            'message' => "{$asset->asset_code} — JEV issued over 10 days ago but not yet uploaded by MES.",
            'asset_id' => $asset->id,
        ]);
    }
}