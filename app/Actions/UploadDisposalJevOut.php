<?php

namespace App\Actions;

use App\Enums\AssetStatus;
use App\Models\DisposalJev;
use App\Models\User;
use App\Services\AssetLifecycleService;
use App\Services\AuditLogService;
use App\Services\PdfDocumentService;
use DomainException;
use Illuminate\Support\Facades\DB;

class UploadDisposalJevOut
{
    public function __construct(
        protected AssetLifecycleService $lifecycleService,
        protected PdfDocumentService $pdfDocumentService,
        protected AuditLogService $auditLogService,
    ) {}

    public function execute(DisposalJev $disposalJev, User $mesUser): DisposalJev
    {
        if ($disposalJev->uploaded_at !== null) {
            throw new DomainException('JEV Out has already been uploaded.');
        }

        $disposal = $disposalJev->disposal;
        $donation = $disposal->donation;

        if (! $donation) {
            throw new DomainException('This disposal has no associated donation.');
        }

        $asset = $disposal->asset;

        return DB::transaction(function () use ($disposalJev, $disposal, $donation, $asset, $mesUser) {
            $disposalJev->update([
                'uploaded_by_mes_id' => $mesUser->id,
                'uploaded_at' => now(),
            ]);

            $this->pdfDocumentService->generateReleaseOrder($asset, $disposal, $donation);
            $this->pdfDocumentService->generateDonationWaybill($asset, $disposal, $donation);

            if ($asset->current_status === AssetStatus::DonationPendingJevOut) {
                $this->lifecycleService->transition(
                    $asset->fresh(),
                    AssetStatus::PendingRelease,
                    $mesUser,
                    "JEV Out {$disposalJev->jev_number} uploaded by MES — Release Order and Waybill generated.",
                    'disposal_jev.uploaded',
                );
            }

            $this->auditLogService->log(
                'disposal_jev.uploaded', $disposalJev, null, $disposalJev->fresh()->toArray(), $mesUser->id
            );

            return $disposalJev->fresh();
        });
    }
}