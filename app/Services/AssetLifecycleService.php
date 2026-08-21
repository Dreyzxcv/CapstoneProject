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
            AssetStatus::Stored,
        ],
        AssetStatus::Stored->value => [
            AssetStatus::DocumentsUploaded,
            AssetStatus::UnderTrial,
            AssetStatus::ClearedForAccounting,
        ],
        AssetStatus::DocumentsUploaded->value => [
            AssetStatus::PendingCustodyReview,
        ],
        AssetStatus::PendingCustodyReview->value => [
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
            AssetStatus::DonationPendingJevOut,
            AssetStatus::PendingRelease,
            AssetStatus::Decayed,
            AssetStatus::Fabricated,
            AssetStatus::Released,
            AssetStatus::Forfeited,
            AssetStatus::Damaged,
        ],
        AssetStatus::DonationPendingJevOut->value => [
            AssetStatus::PendingRelease,
        ],
        AssetStatus::PendingRelease->value => [
            AssetStatus::Donated,
        ],
    ];

    public function __construct(
        protected AuditLogService $auditLogService,
        protected NotificationService $notificationService,
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

            $this->notificationService->notifyForTransition($asset->fresh(), $to, $user);

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
                'summary' => 'The asset has been recorded by MES.',
                'nextAction' => 'Asset will be automatically moved to Stored after intake.',
            ],
            AssetStatus::Stored => [
                'title' => 'In Storage',
                'summary' => 'The asset is in storage. MES must upload the required documents to proceed.',
                'nextAction' => 'Upload all required documents to submit for custody review.',
            ],
            AssetStatus::DocumentsUploaded => [
                'title' => 'Documents Uploaded',
                'summary' => 'MES has uploaded the required documents and submitted for custody review.',
                'nextAction' => 'Property Custodian must verify the documents and approve custody.',
            ],
            AssetStatus::PendingCustodyReview => [
                'title' => 'Pending Custody Review',
                'summary' => 'MES has submitted the required documents. Property Custodian must verify and tag the asset.',
                'nextAction' => 'Verify all documents, then click "Mark as Tagged" to generate the acknowledgement receipt and QR tag.',
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
            AssetStatus::ForDisposal => $this->forDisposalGuide($asset),
            AssetStatus::DonationPendingJevOut => [
                'title' => 'Awaiting JEV Out',
                'summary' => 'Deed of Donation is on file; Accounting must issue JEV Out before the Release Order and Waybill can be generated.',
                'nextAction' => 'Accounting: issue JEV Out for this donation disposal.',
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

    protected function forDisposalGuide(Asset $asset): array
    {
        $disposed = $asset->disposed_quantity ?? 0;
        $total = $asset->quantity ?? 1;

        if ($disposed > 0 && $disposed < $total) {
            $remaining = $total - $disposed;

            return [
                'title' => 'Disposal Processing',
                'summary' => "{$disposed} of {$total} unit(s) already disposed ({$remaining} remaining).",
                'nextAction' => 'Continue processing the rest via donation, decay report, or fabrication as appropriate.',
            ];
        }

        return [
            'title' => 'Disposal Processing',
            'summary' => 'The asset is ready for disposal based on the item type and legal pathway.',
            'nextAction' => 'Process the appropriate disposal action for lumber, conveyance, or tools.',
        ];
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