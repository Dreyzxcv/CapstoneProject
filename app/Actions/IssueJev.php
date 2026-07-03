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

    public function execute(Asset $asset, array $data, User $accountingUser): Jev
    {
        if ($asset->current_status !== AssetStatus::ClearedForAccounting) {
            throw new DomainException('Asset is not cleared for accounting.');
        }

        if ($asset->jev) {
            throw new DomainException('JEV already exists for this asset.');
        }

        return DB::transaction(function () use ($asset, $data, $accountingUser) {
            $jev = Jev::create([
                'asset_id' => $asset->id,
                'jev_number' => $data['jev_number'],
                'funding_source_code' => $data['funding_source_code'] ?? null,
                'funding_source_label' => $data['funding_source_label'] ?? null,
                'transaction_type' => $data['transaction_type'] ?? null,
                'transaction_code' => $data['transaction_code'] ?? null,
                'responsibility_center' => $data['responsibility_center'] ?? null,
                'particulars' => $data['particulars'] ?? null,
                'document_no' => $data['document_no'] ?? null,
                'prepared_by_name' => $data['prepared_by_name'] ?? $accountingUser->name,
                'approved_by_name' => $data['approved_by_name'] ?? null,
                'line_items' => $data['line_items'] ?? null,
                'created_by_accounting_id' => $accountingUser->id,
            ]);

            $this->pdfDocumentService->generateJev($asset, $jev);

            $this->auditLogService->log('jev.issued', $jev, null, $jev->toArray(), $accountingUser->id);

            return $jev->fresh();
        });
    }
}