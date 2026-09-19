<?php

namespace App\Actions;

use App\Enums\AssetStatus;
use App\Models\Asset;
use App\Models\Jev;
use App\Models\User;
use App\Services\AssetLifecycleService;
use App\Services\AuditLogService;
use DomainException;
use Illuminate\Support\Facades\DB;

class IssueJev
{
    public function __construct(
        protected AuditLogService $auditLogService,
        protected AssetLifecycleService $lifecycle,
    ) {}

    public function execute(Asset $asset, array $data, User $accountingUser): Jev
    {
        if ($asset->current_status !== AssetStatus::ClearedForAccounting) {
            throw new DomainException('Asset is not cleared for accounting.');
        }

        if ($asset->jev) {
            throw new DomainException('JEV already exists for this asset type.');
        }

        return DB::transaction(function () use ($asset, $data, $accountingUser) {
            $assetType = $asset->type instanceof \App\Enums\AssetType
                ? $asset->type->value
                : $asset->type;

            $jev = Jev::create([
                'asset_code'               => $asset->asset_code,
                'asset_type'               => $assetType,
                'jev_number'               => $data['jev_number'],
                'jev_date'                 => $data['jev_date'],
                'particulars'              => $data['particulars'] ?? null,
                'amount'                   => $data['amount'] ?? null,
                'created_by_accounting_id' => $accountingUser->id,
            ]);

            // Transition only THIS asset type to ForDisposal
            $this->lifecycle->transition(
                $asset,
                AssetStatus::ForDisposal,
                $accountingUser,
                'JEV issued — asset cleared for disposal processing. (' . strtoupper($assetType) . ')',
                'jev.issued',
                syncSiblings: false,
            );

            $this->auditLogService->log('jev.issued', $jev, null, $jev->toArray(), $accountingUser->id);

            return $jev->fresh();
        });
    }
}