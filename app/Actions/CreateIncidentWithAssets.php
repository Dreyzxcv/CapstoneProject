<?php

namespace App\Actions;

use App\Enums\AssetMode;
use App\Models\Asset;
use App\Models\AssetPiece;
use App\Models\Document;
use App\Models\Incident;
use Illuminate\Http\UploadedFile;
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

    public function execute(array $incidentData, array $assetsData, User $user, ?UploadedFile $confiscationOrderFile = null): Incident
    {
        if (empty($assetsData)) {
            throw new \DomainException('An incident must include at least one asset.');
        }

        return DB::transaction(function () use ($incidentData, $assetsData, $user, $confiscationOrderFile) {

            $firstAssetMode = AssetMode::from($assetsData[0]['mode'] ?? 'apprehended');

            $isTurnedOver = $firstAssetMode === AssetMode::TurnedOver;

            $claimants = $isTurnedOver
                ? []
                : collect($incidentData['claimants'] ?? [])
                    ->filter(fn ($c) => filled($c['name'] ?? null))
                    ->map(fn ($c) => \Illuminate\Support\Arr::only($c, ['name', 'address', 'contact_number', 'id_type', 'id_number']))
                    ->values()
                    ->all();

            $incident = Incident::create([
                'incident_code'          => $this->generateIncidentCode($incidentData['date_of_apprehension'] ?? null, $firstAssetMode),
                'date_of_apprehension'   => $incidentData['date_of_apprehension'],
                'place_of_apprehension'  => $incidentData['place_of_apprehension'],
                'area'                   => $incidentData['area'] ?? null,
                'coordinates'            => $incidentData['coordinates'] ?? null,
                'has_claimant'           => count($claimants) > 0,
                'apprehending_party'     => $incidentData['apprehending_party'],
                'initial_custodian_name' => $incidentData['initial_custodian_name'] ?? null,
                'date_report_submitted'  => $incidentData['date_report_submitted'] ?? null,
                'created_by'             => $user->id,
            ]);

            if ($claimants) {
                $incident->claimants()->createMany($claimants);
            }

            $hasOngoingCase       = (bool) ($incidentData['has_ongoing_case'] ?? false);
            $hasConfiscationOrder = (bool) ($incidentData['has_confiscation_order'] ?? false);

            foreach ($assetsData as $index => $assetData) {
                $pieces = $this->expandPieces($assetData['pieces'] ?? []);

                $assetData['quantity']      = max(1, count($pieces));
                $assetData['quantity_unit'] = 'pcs';

                $totalBdFt  = collect($pieces)->sum(fn($p) => (float) ($p['volume_bd_ft'] ?? 0));
                $totalCuM   = collect($pieces)->sum(fn($p) => (float) ($p['volume_cu_m'] ?? 0));
                $totalValue = collect($pieces)->sum(fn($p) => (float) ($p['estimated_value'] ?? 0));

                if ($totalBdFt > 0)  $assetData['volume_bd_ft']   = $totalBdFt;
                if ($totalCuM > 0)   $assetData['volume_cu_m']    = $totalCuM;
                if ($totalValue > 0) $assetData['estimated_value'] = $totalValue;

                if (empty($assetData['species']) && ! empty($pieces[0]['species']))
                    $assetData['species'] = $pieces[0]['species'];
                if (empty($assetData['description']) && ! empty($pieces[0]['description']))
                    $assetData['description'] = $pieces[0]['description'];
                if (empty($assetData['length']) && ! empty($pieces[0]['length']))
                    $assetData['length'] = $pieces[0]['length'];
                if (empty($assetData['width']) && ! empty($pieces[0]['width']))
                    $assetData['width'] = $pieces[0]['width'];
                if (empty($assetData['height']) && ! empty($pieces[0]['height']))
                    $assetData['height'] = $pieces[0]['height'];
                if (empty($assetData['plate_number']) && ! empty($pieces[0]['plate_number']))
                    $assetData['plate_number'] = $pieces[0]['plate_number'];

                $assetData['apprehending_agency']  = $assetData['apprehending_agency'] ?? $incidentData['apprehending_party'] ?? 'PENRO Catanduanes MES';
                $assetData['location_apprehended'] = $assetData['location_apprehended'] ?? $incidentData['place_of_apprehension'] ?? '';
                $assetData['has_ongoing_case']       = $hasOngoingCase;
                $assetData['has_confiscation_order'] = $hasConfiscationOrder;
                $assetData['incident_id']  = $incident->id;
                $assetData['has_claimant'] = $incident->has_claimant;

                $asset = $this->createAsset->execute(
                    $assetData,
                    $user,
                    issueReceipt: false,
                    presetAssetCode: $incident->incident_code,
                    itemNumber: $index + 1,
                );

                foreach ($pieces as $pieceIndex => $pieceData) {
                    AssetPiece::create([
                        'asset_id'        => $asset->id,
                        'piece_number'    => $pieceIndex + 1,
                        'qr_code_token'   => Str::random(32),
                        'species'         => $pieceData['species'] ?? null,
                        'equipment_type'  => $pieceData['equipment_type'] ?? null,
                        'vehicle_type'    => $pieceData['vehicle_type'] ?? null,
                        'description'     => $pieceData['description'] ?? null,
                        'length'          => $pieceData['length'] ?? null,
                        'width'           => $pieceData['width'] ?? null,
                        'height'          => $pieceData['height'] ?? null,
                        'volume_bd_ft'    => $pieceData['volume_bd_ft'] ?? null,
                        'volume_cu_m'     => $pieceData['volume_cu_m'] ?? null,
                        'estimated_value' => $pieceData['estimated_value'] ?? null,
                        'plate_number'    => $pieceData['plate_number'] ?? null,
                        'serial_number'   => $pieceData['serial_number'] ?? null,
                    ]);
                }

                // ── Confiscation order — stored per asset, inside the loop ──
                if ($confiscationOrderFile) {
                    $confiscationOrderPath = $confiscationOrderFile->storeAs(
                        "documents/required/{$asset->id}",
                        Str::uuid() . '.pdf',
                        'local'
                    );

                    Document::create([
                        'attachable_type' => Asset::class,
                        'attachable_id'   => $asset->id,
                        'document_type'   => 'confiscation_order',
                        'file_path'       => $confiscationOrderPath,
                        'original_name'   => $confiscationOrderFile->getClientOriginalName(),
                        'mime_type'       => $confiscationOrderFile->getMimeType() ?? 'application/pdf',
                        'status'          => 'pending',
                        'uploaded_by'     => $user->id,
                        'uploaded_at'     => now(),
                    ]);
                }
            }

            $incident->load('assets', 'claimants');

            $this->auditLogService->log('incident.created', $incident, null, $incident->toArray(), $user->id);

            return $incident->fresh('assets.acknowledgementReceipt');
        });
    }

    protected function expandPieces(array $pieces): array
    {
        $expanded = [];
        foreach ($pieces as $piece) {
            $quantity = max(1, (int) ($piece['quantity'] ?? 1));
            unset($piece['quantity']);
            for ($i = 0; $i < $quantity; $i++) {
                $expanded[] = $piece;
            }
        }
        return $expanded;
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
            default => 'AP',
        };

        return $prefix.'-'.$year.'-'.str_pad((string) $sequence, 5, '0', STR_PAD_LEFT);
    }
}