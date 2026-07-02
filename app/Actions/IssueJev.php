<?php

namespace App\Actions;

use App\Enums\AssetStatus;
use App\Models\Asset;
use App\Models\Jev;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\PdfDocumentService;
use DomainException;
use Illuminate\Support\Facades\DB;

class IssueJev
{
    public function __construct(
        protected PdfDocumentService $pdfDocumentService,
        protected AuditLogService $auditLogService,
    ) {}

    public function execute(Asset $asset, string $jevNumber, User $accountingUser): Jev
    {
        if ($asset->current_status !== AssetStatus::ClearedForAccounting) {
            throw new DomainException('Asset is not cleared for accounting.');
        }

        if ($asset->jev) {
            throw new DomainException('JEV already exists for this asset.');
        }

        return DB::transaction(function () use ($asset, $jevNumber, $accountingUser) {
            $jev = Jev::create([
                'asset_id' => $asset->id,
                'jev_number' => $jevNumber,
                'created_by_accounting_id' => $accountingUser->id,
            ]);

            $this->pdfDocumentService->generateJev($asset, $jev);

            $this->auditLogService->log('jev.issued', $jev, null, $jev->toArray(), $accountingUser->id);

            return $jev->fresh();
        });
    }
}
