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
            $hasClaimant = $data['has_claimant'] ?? true;
            $hasConfiscationOrder = ($mode === AssetMode::Apprehended && ! $hasClaimant)
                || ($data['has_confiscation_order'] ?? false);
            $hasOngoingCase = $data['has_ongoing_case'] ?? false;
            $municipality = Municipality::from($data['municipality_of_origin']);

            $length = array_key_exists('length', $data) && $data['length'] !== null && $data['length'] !== ''
                ? (float) $data['length']
                : null;
            $width = array_key_exists('width', $data) && $data['width'] !== null && $data['width'] !== ''
                ? (float) $data['width']
                : null;
            $height = array_key_exists('height', $data) && $data['height'] !== null && $data['height'] !== ''
                ? (float) $data['height']
                : null;
            $volumeBdFt = array_key_exists('volume_bd_ft', $data) && $data['volume_bd_ft'] !== null && $data['volume_bd_ft'] !== ''
                ? (float) $data['volume_bd_ft']
                : null;
            $volumeCuM = array_key_exists('volume_cu_m', $data) && $data['volume_cu_m'] !== null && $data['volume_cu_m'] !== ''
                ? (float) $data['volume_cu_m']
                : null;

            $asset = Asset::create([
                'incident_id' => $data['incident_id'] ?? null,
                'asset_code' => 'PENDING', // placeholder; replaced below once we have the DB id
                'type' => AssetType::from($data['type']),
                'species' => $data['species'] ?? null,
                'description' => $data['description'] ?? null,
                'quantity' => $data['quantity'] ?? 1,
                'quantity_unit' => $data['quantity_unit'] ?? 'pcs',
                'length' => $length,
                'width' => $width,
                'height' => $height,
                'volume_bd_ft' => $volumeBdFt,
                'volume_cu_m' => $volumeCuM,
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

    public function issueReceiptFor(Asset $asset, ?User $custodian = null): AcknowledgementReceipt
    {
        $receiptNumber = 'AR-'.now()->format('Y').'-'.str_pad((string) $asset->id, 5, '0', STR_PAD_LEFT);

        $receipt = AcknowledgementReceipt::create([
            'asset_id' => $asset->id,
            'receipt_number' => $receiptNumber,
            'signed_by_custodian_id' => $custodian?->id,
            'signed_at' => $custodian ? now() : null,
        ]);

        $this->pdfDocumentService->generateAcknowledgementReceipt($asset, $receipt);

        return $receipt;
    }
}