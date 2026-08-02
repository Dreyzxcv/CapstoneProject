<?php

namespace App\Actions;

use App\Enums\AssetStatus;
use App\Enums\DisposalType;
use App\Models\Disposal;
use App\Models\DisposalJev;
use App\Models\User;
use App\Services\AssetLifecycleService;
use App\Services\AuditLogService;
use App\Services\PdfDocumentService;
use DomainException;
use Illuminate\Support\Facades\DB;

class IssueDisposalJevOut
{
    public function __construct(
        protected AssetLifecycleService $lifecycleService,
        protected PdfDocumentService $pdfDocumentService,
        protected AuditLogService $auditLogService,
    ) {}

    public function execute(Disposal $disposal, array $data, User $accountingUser): DisposalJev
    {
        if ($disposal->disposal_type !== DisposalType::Donation) {
            throw new DomainException('JEV Out only applies to donation disposals.');
        }

        if ($disposal->disposalJev) {
            throw new DomainException('JEV Out has already been issued for this disposal.');
        }

        $donation = $disposal->donation;

        if (! $donation) {
            throw new DomainException('This disposal has no associated donation.');
        }

        $asset = $disposal->asset;

        return DB::transaction(function () use ($disposal, $asset, $donation, $data, $accountingUser) {
            $disposalJev = DisposalJev::create([
                'disposal_id' => $disposal->id,
                'jev_number' => $data['jev_number'],
                'issued_by_accounting_id' => $accountingUser->id,
            ]);

            $this->auditLogService->log('disposal_jev.issued', $disposalJev, null, $disposalJev->toArray(), $accountingUser->id);

            $disposal->setRelation('disposalJev', $disposalJev);

            $this->pdfDocumentService->generateReleaseOrder($asset, $disposal, $donation);
            $this->pdfDocumentService->generateDonationWaybill($asset, $disposal, $donation);

            if ($asset->current_status === AssetStatus::DonationPendingJevOut) {
                $this->lifecycleService->transition(
                    $asset->fresh(),
                    AssetStatus::PendingRelease,
                    $accountingUser,
                    "JEV Out {$disposalJev->jev_number} issued — Release Order and Waybill generated.",
                    'disposal_jev.issued',
                );
            }

            return $disposalJev->fresh();
        });
    }
}