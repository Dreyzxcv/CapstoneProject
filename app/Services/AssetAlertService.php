<?php

namespace App\Services;

use App\Enums\AssetStatus;
use App\Enums\AssetType;
use App\Models\Asset;
use App\Models\User;
use Carbon\Carbon;
use Closure;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class AssetAlertService
{
    public const DEFAULT_LIMIT = 15;
    public const DECAY_DAYS = 30;
    public const STALE_DAYS = 7;

    protected const OVERSIGHT_ROLES = [
        'System Admin',
        'PENRO Management',
        'PENRO Supervisor',
        'Regional Supervisor',
    ];

    /**
     * Legacy-compatible: returns the (limited) alert collection.
     * Passing no user keeps the old behaviour (everything visible, asset links only).
     */
    public function generate(?User $user = null, ?int $limit = self::DEFAULT_LIMIT): Collection
    {
        return $this->forUser($user, $limit)['alerts'];
    }

    /**
     * @return array{alerts: Collection, total: int}
     */
    public function forUser(?User $user, ?int $limit = self::DEFAULT_LIMIT): array
    {
        $sorted = collect()
            ->merge($this->appealDeadlineAlerts())
            ->merge($this->staleDisposalAlerts())
            ->merge($this->stalePendingUploadAlerts())
            ->merge($this->stalePendingReviewAlerts())
            ->merge($this->staleTaggingAlerts())
            ->merge($this->staleDonationAlerts())
            ->map(fn (array $alert) => $this->applyAccess($alert, $user))
            ->filter()
            ->sortBy([
                ['severity_rank', 'asc'],
                ['actionable', 'desc'],
                ['sort_key', 'asc'],
            ])
            ->values();

        return [
            'alerts' => $limit === null ? $sorted : $sorted->take($limit)->values(),
            'total'  => $sorted->count(),
        ];
    }

    /**
     * Vehicles whose 15-day appeal window is closing soon or has already
     * closed without a disposal decision (release/forfeiture) yet.
     */
    protected function appealDeadlineAlerts(): Collection
    {
        return Asset::query()
            ->where('type', AssetType::Vehicle->value)
            ->whereNotNull('appeal_deadline')
            ->whereColumn('disposed_quantity', '<', 'quantity')
            ->where('appeal_deadline', '<=', now()->addDays(3))
            ->get()
            ->map(function (Asset $asset) {
                $deadline = $asset->appeal_deadline;
                $overdue  = $deadline->isPast();
                $date     = $deadline->format('M d, Y');

                if ($overdue) {
                    $days    = $this->daysSince($deadline);
                    $message = "{$asset->asset_code}: appeal deadline passed {$days} "
                        . Str::plural('day', $days) . " ago ({$date}). Release or forfeiture decision is due.";
                } else {
                    $message = "{$asset->asset_code}: appeal window closes {$date} ({$deadline->diffForHumans()}).";
                }

                $canDispose = $overdue && $asset->current_status === AssetStatus::ForDisposal;

                return [
                    'id'            => "appeal-{$asset->id}",
                    'severity'      => $overdue ? 'critical' : 'warning',
                    'severity_rank' => $overdue ? 0 : 1,
                    'title'         => $overdue ? 'Appeal window closed' : 'Appeal window closing soon',
                    'message'       => $message,
                    'asset_id'      => $asset->id,
                    'asset_code'    => $asset->asset_code,
                    'deadline'      => $deadline->toDateString(),
                    'waiting_days'  => $overdue ? $this->daysSince($deadline) : null,
                    'sort_key'      => $deadline->getTimestamp(),
                    'permission'    => 'disposals.process',
                    'action'        => $canDispose
                        ? ['label' => 'Process disposal', 'route' => 'disposals.create']
                        : ['label' => 'Review asset', 'route' => 'assets.show'],
                ];
            });
    }

    /**
     * Logs sitting in "for disposal" for over 30 days: decay risk.
     */
    protected function staleDisposalAlerts(): Collection
    {
        return $this->stalledInStatus(
            AssetStatus::ForDisposal,
            self::DECAY_DAYS,
            fn ($q) => $q->where('type', AssetType::Log->value),
        )->map(fn (array $row) => $this->stalledAlert(
            prefix: 'decay',
            row: $row,
            severity: 'warning',
            rank: 1,
            title: 'Decay risk',
            what: 'has been awaiting disposal',
            suffix: 'Check for decay before further deterioration.',
            permission: 'disposals.process',
            actionLabel: 'Process disposal',
            route: 'disposals.create',
        ));
    }

    /**
     * Stored assets still waiting for MES to upload documents. Assets that
     * already went through custody review are excluded (they are stored after
     * tagging, not waiting for upload).
     */
    protected function stalePendingUploadAlerts(): Collection
    {
        return $this->stalledInStatus(
            AssetStatus::Stored,
            self::STALE_DAYS,
            fn ($q) => $q->whereDoesntHave('statusHistory', fn ($h) => $h
                ->where('event_type', 'status_change')
                ->whereIn('status', [
                    AssetStatus::DocumentsUploaded->value,
                    AssetStatus::PendingCustodyReview->value,
                    AssetStatus::DocumentsVerified->value,
                ])),
        )->map(fn (array $row) => $this->stalledAlert(
            prefix: 'upload',
            row: $row,
            severity: 'info',
            rank: 2,
            title: 'Documents not uploaded',
            what: 'has been in storage without required documents',
            suffix: 'Upload them to submit for custody review.',
            permission: 'assets.submit_custody_review',
            actionLabel: 'Upload documents',
        ));
    }

    /**
     * Assets stuck in custody review for more than a week. Age counts from
     * when the asset entered the status, not from creation.
     */
    protected function stalePendingReviewAlerts(): Collection
    {
        return $this->stalledInStatus(AssetStatus::PendingCustodyReview, self::STALE_DAYS)
            ->map(fn (array $row) => $this->stalledAlert(
                prefix: 'review',
                row: $row,
                severity: 'info',
                rank: 2,
                title: 'Custody review overdue',
                what: 'has been pending custody review',
                suffix: null,
                permission: 'documents.verify',
                actionLabel: 'Review documents',
            ));
    }

    /**
     * Documents verified but the asset is still not tagged.
     */
    protected function staleTaggingAlerts(): Collection
    {
        return $this->stalledInStatus(AssetStatus::DocumentsVerified, self::STALE_DAYS)
            ->map(fn (array $row) => $this->stalledAlert(
                prefix: 'tagging',
                row: $row,
                severity: 'info',
                rank: 2,
                title: 'Awaiting tagging',
                what: 'has been verified and is still waiting to be tagged',
                suffix: null,
                permission: 'assets.generate_qr',
                actionLabel: 'Tag asset',
            ));
    }

    /**
     * Donations stuck at JEV Out or at release.
     */
    protected function staleDonationAlerts(): Collection
    {
        $jevOut = $this->stalledInStatus(AssetStatus::DonationPendingJevOut, self::STALE_DAYS)
            ->map(fn (array $row) => $this->stalledAlert(
                prefix: 'jev-out',
                row: $row,
                severity: 'info',
                rank: 2,
                title: 'JEV Out pending',
                what: 'has been waiting for JEV Out',
                suffix: null,
                permission: 'jev.create',
                actionLabel: 'Issue JEV Out',
            ));

        $release = $this->stalledInStatus(AssetStatus::PendingRelease, self::STALE_DAYS)
            ->map(fn (array $row) => $this->stalledAlert(
                prefix: 'release',
                row: $row,
                severity: 'info',
                rank: 2,
                title: 'Donation release pending',
                what: 'has been awaiting release to the donee',
                suffix: null,
                permission: 'disposals.process',
                actionLabel: 'Confirm release',
            ));

        return $jevOut->merge($release);
    }

    /**
     * Assets currently in $status for at least $days, measured from the latest
     * status_change history entry for that status. Falls back to created_at
     * only when no history row exists.
     *
     * @return Collection<int, array{asset: Asset, since: Carbon}>
     */
    protected function stalledInStatus(AssetStatus $status, int $days, ?Closure $scope = null): Collection
    {
        $threshold = now()->subDays($days);

        $query = Asset::query()
            ->where('current_status', $status->value)
            ->with(['statusHistory' => fn ($q) => $q
                ->where('event_type', 'status_change')
                ->where('status', $status->value)
                ->orderByDesc('changed_at')]);

        if ($scope) {
            $scope($query);
        }

        return $query->get()
            ->map(function (Asset $asset) {
                $entry = $asset->statusHistory->first();

                return [
                    'asset' => $asset,
                    'since' => $entry?->changed_at
                        ? Carbon::parse($entry->changed_at)
                        : $asset->created_at,
                ];
            })
            ->filter(fn (array $row) => $row['since']->lte($threshold))
            ->values();
    }

    protected function stalledAlert(
        string $prefix,
        array $row,
        string $severity,
        int $rank,
        string $title,
        string $what,
        ?string $suffix,
        string $permission,
        string $actionLabel,
        string $route = 'assets.show',
    ): array {
        /** @var Asset $asset */
        $asset = $row['asset'];
        $since = $row['since'];
        $days  = $this->daysSince($since);

        $message = "{$asset->asset_code} {$what} for {$days} " . Str::plural('day', $days)
            . " (since {$since->format('M d, Y')}).";
        if ($suffix) {
            $message .= ' ' . $suffix;
        }

        return [
            'id'            => "{$prefix}-{$asset->id}",
            'severity'      => $severity,
            'severity_rank' => $rank,
            'title'         => $title,
            'message'       => $message,
            'asset_id'      => $asset->id,
            'asset_code'    => $asset->asset_code,
            'deadline'      => null,
            'waiting_days'  => $days,
            'sort_key'      => $since->getTimestamp(),
            'permission'    => $permission,
            'action'        => ['label' => $actionLabel, 'route' => $route],
        ];
    }

    /**
     * Decide visibility and the action link for this user. Returns null when
     * the alert should not be shown to them at all.
     */
    protected function applyAccess(array $alert, ?User $user): ?array
    {
        $canAct    = $user !== null && $user->can($alert['permission']);
        $oversight = $user === null || $user->hasAnyRole(self::OVERSIGHT_ROLES);

        if (! $canAct && ! $oversight) {
            return null;
        }

        $canOpenAsset = $user === null || $user->can('assets.view');
        $spec         = $alert['action'];
        $action       = null;

        if ($canAct && ($spec['route'] !== 'assets.show' || $canOpenAsset)) {
            $action = [
                'label' => $spec['label'],
                'href'  => route($spec['route'], $alert['asset_id'], false),
            ];
        } elseif ($canOpenAsset) {
            $action = [
                'label' => 'View asset',
                'href'  => route('assets.show', $alert['asset_id'], false),
            ];
        }

        unset($alert['permission']);

        return array_merge($alert, [
            'actionable' => $canAct,
            'action'     => $action,
        ]);
    }

    protected function daysSince(Carbon $date): int
    {
        return (int) floor(abs($date->diffInDays(now())));
    }
}