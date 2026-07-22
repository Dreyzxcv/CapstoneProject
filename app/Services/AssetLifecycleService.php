<?php

namespace App\Services;

use App\Enums\AssetStatus;
use App\Enums\DisposalType;
use App\Models\Asset;
use App\Models\AssetCaseStatusHistory;
use App\Models\User;
use DomainException;
use Illuminate\Support\Facades\DB;

class AssetLifecycleService
{
    /** @var array<string, list<AssetStatus>> */
    protected array $transitions = [
        AssetStatus::IntakeRecorded->value => [
            AssetStatus::PendingCustodyReview,
        ],
        AssetStatus::PendingCustodyReview->value => [
            AssetStatus::ReceiptSigned,
        ],
        AssetStatus::ReceiptSigned->value => [
            AssetStatus::Stored,
        ],
        AssetStatus::Stored->value => [
            AssetStatus::UnderTrial,
            AssetStatus::ClearedForAccounting,
        ],
        AssetStatus::UnderTrial->value => [
            AssetStatus::ClearedForAccounting,
        ],
        AssetStatus::ClearedForAccounting->value => [
            AssetStatus::ForDisposal,
        ],
        AssetStatus::ForDisposal->value => [
            AssetStatus::PendingRelease,
            AssetStatus::Decayed,
            AssetStatus::Fabricated,
            AssetStatus::Released,
            AssetStatus::Forfeited,
            AssetStatus::Damaged,
        ],
        AssetStatus::PendingRelease->value => [
            AssetStatus::Donated,
        ],
    ];

    public function __construct(
        protected AuditLogService $auditLogService,
    ) {}

    public function canTransition(Asset $asset, AssetStatus $to): bool
    {
        $allowed = $this->transitions[$asset->current_status->value] ?? [];

        return in_array($to, $allowed, true);
    }

    public function transition(
        Asset $asset,
        AssetStatus $to,
        User $user,
        ?string $notes = null,
        ?string $auditAction = null,
    ): Asset {
        if (! $this->canTransition($asset, $to)) {
            throw new DomainException(
                "Cannot transition asset from {$asset->current_status->value} to {$to->value}."
            );
        }

        return DB::transaction(function () use ($asset, $to, $user, $notes, $auditAction) {
            $oldStatus = $asset->current_status;

            $asset->update(['current_status' => $to]);

            AssetCaseStatusHistory::create([
                'asset_id' => $asset->id,
                'status' => $to,
                'changed_by' => $user->id,
                'notes' => $notes,
                'changed_at' => now(),
            ]);

            $this->auditLogService->log(
                $auditAction ?? 'asset.status_changed',
                $asset,
                ['current_status' => $oldStatus->value],
                ['current_status' => $to->value],
                $user->id,
            );

            return $asset->fresh();
        });
    }

    public function resolveCaseBranch(Asset $asset, User $user): Asset
    {
        if ($asset->has_ongoing_case && ! $asset->has_confiscation_order) {
            return $this->transition(
                $asset,
                AssetStatus::UnderTrial,
                $user,
                'Asset has ongoing case — held in Property custody.',
            );
        }

        return $this->transition(
            $asset,
            AssetStatus::ClearedForAccounting,
            $user,
            'Asset cleared for Property and Accounting.',
        );
    }

    public function workflowGuide(Asset $asset): array
    {
        return match ($asset->current_status) {
            AssetStatus::IntakeRecorded => [
                'title' => 'MES Intake',
                'summary' => 'The asset has been recorded by MES and is awaiting custody review.',
                'nextAction' => 'Move the asset to the property custody review queue.',
            ],
            AssetStatus::PendingCustodyReview => [
                'title' => 'Property Custody Review',
                'summary' => 'The asset must be reviewed and signed before it is tagged for storage.',
                'nextAction' => 'Sign the acknowledgement receipt and verify the documentation.',
            ],
            AssetStatus::ReceiptSigned => [
                'title' => 'Storage Preparation',
                'summary' => 'The acknowledgement receipt has been signed, and the item is ready for tagging and storage.',
                'nextAction' => 'Mark the asset as stored once the QR tag and physical placement are complete.',
            ],
            AssetStatus::Stored => [
                'title' => 'Custody Holding',
                'summary' => 'The asset is now in storage and can proceed to legal or accounting follow-up.',
                'nextAction' => 'Route the asset to trial, accounting, or disposal based on case status.',
            ],
            AssetStatus::UnderTrial => [
                'title' => 'Case Hold',
                'summary' => 'The asset is under legal or court-related hold.',
                'nextAction' => 'Wait for the case outcome before clearing it for accounting.',
            ],
            AssetStatus::ClearedForAccounting => [
                'title' => 'Accounting Review',
                'summary' => 'The asset is ready for JEV creation and subsequent disposal processing.',
                'nextAction' => 'Create the JEV and upload it to continue the disposal workflow.',
            ],
            AssetStatus::ForDisposal => [
                'title' => 'Disposal Processing',
                'summary' => 'The asset is ready for disposal based on the item type and legal pathway.',
                'nextAction' => 'Process the appropriate disposal action for lumber, conveyance, or tools.',
            ],
            AssetStatus::PendingRelease => [
                'title' => 'Awaiting Release',
                'summary' => 'Deed of Donation is on file; the item is awaiting confirmed delivery to the donee.',
                'nextAction' => 'Confirm release once the item has been physically handed over.',
            ],
            default => [
                'title' => 'Completed Workflow',
                'summary' => 'The asset has reached a terminal or closed state.',
                'nextAction' => 'No further workflow action is required.',
            ],
        };
    }

    public function allowedDisposalTypes(Asset $asset): array
    {
        return match ($asset->type) {
            \App\Enums\AssetType::Log => [
                DisposalType::Donation,
                DisposalType::Decayed,
                DisposalType::Fabricated,
            ],
            \App\Enums\AssetType::Vehicle => [
                DisposalType::Released,
                DisposalType::Forfeited,
            ],
            \App\Enums\AssetType::Equipment => [
                DisposalType::Damaged,
            ],
        };
    }
}
