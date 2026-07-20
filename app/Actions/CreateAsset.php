<?php
// app/Actions/CreateAsset.php

namespace App\Actions;

use App\Enums\AssetMode;
use App\Enums\AssetStatus;
use App\Enums\AssetType;
use App\Enums\Municipality;
use App\Models\AcknowledgementReceipt;
use App\Models\Asset;
use App\Models\User;
use App\Services\AssetCodeService;
use App\Services\AssetLifecycleService;
use App\Services\AuditLogService;
use App\Services\PdfDocumentService;
use App\Services\QrCodeService;
use Illuminate\Support\Facades\DB;

class CreateAsset
{
    public function __construct(
        protected QrCodeService $qrCodeService,
        protected PdfDocumentService $pdfDocumentService,
        protected AssetLifecycleService $lifecycleService,
        protected AuditLogService $auditLogService,
        protected AssetCodeService $assetCodeService,
    ) {}

    public function execute(array $data, User $user, bool $issueReceipt = true): Asset
    {
        return DB::transaction(function () use ($data, $user, $issueReceipt) {
            $mode = AssetMode::from($data['mode']);
            $hasConfiscationOrder = $mode === AssetMode::Abandoned
                || ($data['has_confiscation_order'] ?? false);
            $hasOngoingCase = $data['has_ongoing_case'] ?? false;
            $municipality = Municipality::from($data['municipality_of_origin']);

            $asset = Asset::create([
                'incident_id' => $data['incident_id'] ?? null,
                'asset_code' => 'PENDING', // placeholder; replaced below once we have the DB id
                'type' => AssetType::from($data['type']),
                'species' => $data['species'] ?? null,
                'description' => $data['description'] ?? null,
                'quantity' => $data['quantity'] ?? 1,
                'volume_bd_ft' => $data['volume_bd_ft'] ?? null,
                'volume_cu_m' => $data['volume_cu_m'] ?? null,
                'estimated_value' => $data['estimated_value'] ?? null,
                'plate_number' => $data['plate_number'] ?? null,
                'municipality_of_origin' => $municipality->value,
                'location_apprehended' => $data['location_apprehended'],
                'apprehending_agency' => $data['apprehending_agency'],
                'mode' => $mode,
                'has_ongoing_case' => $hasOngoingCase,
                'has_confiscation_order' => $hasConfiscationOrder,
                'current_status' => AssetStatus::IntakeRecorded,
                'qr_code_token' => $this->qrCodeService->generateToken(),
                'metadata' => $data['metadata'] ?? null,
                'created_by' => $user->id,
            ]);

            $asset->update([
                'asset_code' => $this->assetCodeService->generate($asset, $municipality, $hasOngoingCase),
            ]);

            if ($issueReceipt) {
                $this->issueReceiptFor($asset);
            }

            $this->lifecycleService->transition(
                $asset->fresh(),
                AssetStatus::PendingCustodyReview,
                $user,
                'Intake encoded by MES.',
                'asset.created',
            );

            $this->auditLogService->log('asset.intake_created', $asset, null, $asset->toArray(), $user->id);

            return $asset->fresh(['acknowledgementReceipt', 'creator', 'incident', 'documents']);
        });
    }

    public function issueReceiptFor(Asset $asset): AcknowledgementReceipt
    {
        $receiptNumber = 'AR-'.now()->format('Y').'-'.str_pad((string) $asset->id, 5, '0', STR_PAD_LEFT);

        $receipt = AcknowledgementReceipt::create([
            'asset_id' => $asset->id,
            'receipt_number' => $receiptNumber,
        ]);

        $this->pdfDocumentService->generateAcknowledgementReceipt($asset, $receipt);

        return $receipt;
    }
}