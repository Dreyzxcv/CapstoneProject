<?php
// app/Actions/CreateIncidentWithAssets.php

namespace App\Actions;

use App\Enums\AssetMode;
use App\Models\AssetPiece;
use App\Models\Incident;
use App\Models\User;
use App\Services\AuditLogService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateIncidentWithAssets
{
    public function __construct(
        protected CreateAsset $createAsset,
        protected AuditLogService $auditLogService,
    ) {}

    /**
     * @param array $incidentData Incident-level fields
     * @param array<int, array> $assetsData Per-asset payloads. Each asset must include
     *   a `pieces` key: an array of per-piece measurements encoded 1-by-1 by MES.
     *   The asset's `quantity` is derived from the count of pieces automatically.
     */
    public function execute(array $incidentData, array $assetsData, User $user): Incident
    {
        if (empty($assetsData)) {
            throw new \DomainException('An incident must include at least one asset.');
        }

        return DB::transaction(function () use ($incidentData, $assetsData, $user) {
            $firstAssetMode = AssetMode::from($assetsData[0]['mode'] ?? 'apprehended');

            $incident = Incident::create([
                'incident_code'          => $this->generateIncidentCode($incidentData['date_of_apprehension'] ?? null, $firstAssetMode),
                'date_of_apprehension'   => $incidentData['date_of_apprehension'],
                'place_of_apprehension'  => $incidentData['place_of_apprehension'],
                'area'                   => $incidentData['area'] ?? null,
                'coordinates'            => $incidentData['coordinates'] ?? null,
                'claimant_offender_name' => $incidentData['claimant_offender_name'] ?? null,
                'has_claimant'           => $incidentData['has_claimant'] ?? true,
                'claimant_address'       => $incidentData['claimant_address'] ?? null,
                'claimant_contact_number'=> $incidentData['claimant_contact_number'] ?? null,
                'claimant_id_type'       => $incidentData['claimant_id_type'] ?? null,
                'claimant_id_number'     => $incidentData['claimant_id_number'] ?? null,
                'apprehending_party'     => $incidentData['apprehending_party'],
                'initial_custodian_name' => $incidentData['initial_custodian_name'] ?? null,
                'date_report_submitted'  => $incidentData['date_report_submitted'] ?? null,
                'created_by'             => $user->id,
            ]);

            foreach ($assetsData as $index => $assetData) {
                $pieces = $assetData['pieces'] ?? [];

                // Derive quantity from the number of pieces encoded —
                // MES encodes each piece individually, so count IS the quantity.
                $assetData['quantity']      = max(1, count($pieces));
                $assetData['quantity_unit'] = 'pcs';

                // Roll up aggregate volume / estimated value from pieces for
                // the parent asset record (useful for reports and the asset show page).
                $totalBdFt  = collect($pieces)->sum(fn($p) => (float) ($p['volume_bd_ft'] ?? 0));
                $totalCuM   = collect($pieces)->sum(fn($p) => (float) ($p['volume_cu_m'] ?? 0));
                $totalValue = collect($pieces)->sum(fn($p) => (float) ($p['estimated_value'] ?? 0));

                if ($totalBdFt > 0)  $assetData['volume_bd_ft']    = $totalBdFt;
                if ($totalCuM > 0)   $assetData['volume_cu_m']     = $totalCuM;
                if ($totalValue > 0) $assetData['estimated_value']  = $totalValue;

                // Use the first piece's species as the parent species if the asset
                // row doesn't have one set (all pieces of the same species is common).
                if (empty($assetData['species']) && ! empty($pieces[0]['species'])) {
                    $assetData['species'] = $pieces[0]['species'];
                }

                $assetData['incident_id'] = $incident->id;
                $assetData['has_claimant'] = $incident->has_claimant;

                $asset = $this->createAsset->execute(
                    $assetData,
                    $user,
                    issueReceipt: false,
                    presetAssetCode: $incident->incident_code,
                    itemNumber: $index + 1,
                );

                // Create one AssetPiece record per encoded piece.
                foreach ($pieces as $pieceIndex => $pieceData) {
                    AssetPiece::create([
                        'asset_id'        => $asset->id,
                        'piece_number'    => $pieceIndex + 1,
                        'qr_code_token'   => Str::random(32),
                        'species'         => $pieceData['species'] ?? null,
                        'description'     => $pieceData['description'] ?? null,
                        'length'          => $pieceData['length'] ?? null,
                        'width'           => $pieceData['width'] ?? null,
                        'height'          => $pieceData['height'] ?? null,
                        'volume_bd_ft'    => $pieceData['volume_bd_ft'] ?? null,
                        'volume_cu_m'     => $pieceData['volume_cu_m'] ?? null,
                        'estimated_value' => $pieceData['estimated_value'] ?? null,
                        'plate_number'    => $pieceData['plate_number'] ?? null,
                    ]);
                }
            }

            $incident->load('assets');

            $this->auditLogService->log('incident.created', $incident, null, $incident->toArray(), $user->id);

            return $incident->fresh('assets.acknowledgementReceipt');
        });
    }

    protected function generateIncidentCode(?string $dateOfApprehension = null, ?AssetMode $mode = null): string
    {
        $year = $dateOfApprehension
            ? \Illuminate\Support\Carbon::parse($dateOfApprehension)->format('Y')
            : now()->format('Y');

        $sequence = \App\Models\Incident::count() + 1;
        $prefix = match ($mode) {
            AssetMode::Apprehended => 'AP',
            AssetMode::TurnedOver  => 'TO',
            default                => 'AP',
        };

        return $prefix.'-'.$year.'-'.str_pad((string) $sequence, 5, '0', STR_PAD_LEFT);
    }
}