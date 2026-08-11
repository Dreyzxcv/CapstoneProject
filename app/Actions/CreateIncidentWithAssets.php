<?php
// app/Actions/CreateIncidentWithAssets.php

namespace App\Actions;

use App\Enums\AssetMode;
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
     * @param array $incidentData Incident-level fields (date_of_apprehension, place_of_apprehension, etc.)
     * @param array<int, array> $assetsData One or more per-asset payloads (type, species/description, quantity, etc.)
     */
    public function execute(array $incidentData, array $assetsData, User $user): Incident
    {
        if (empty($assetsData)) {
            throw new \DomainException('An incident must include at least one asset.');
        }

        return DB::transaction(function () use ($incidentData, $assetsData, $user) {
            $firstAssetMode = AssetMode::from($assetsData[0]['mode'] ?? 'apprehended');

            $incident = Incident::create([
                'incident_code' => $this->generateIncidentCode($incidentData['date_of_apprehension'] ?? null, $firstAssetMode),
                'date_of_apprehension' => $incidentData['date_of_apprehension'],
                'place_of_apprehension' => $incidentData['place_of_apprehension'],
                'area' => $incidentData['area'] ?? null,
                'coordinates' => $incidentData['coordinates'] ?? null,
                'claimant_offender_name' => $incidentData['claimant_offender_name'] ?? null,
                'has_claimant' => $incidentData['has_claimant'] ?? true,
                'claimant_address' => $incidentData['claimant_address'] ?? null,
                'claimant_contact_number' => $incidentData['claimant_contact_number'] ?? null,
                'claimant_id_type' => $incidentData['claimant_id_type'] ?? null,
                'claimant_id_number' => $incidentData['claimant_id_number'] ?? null,
                'apprehending_party' => $incidentData['apprehending_party'],
                'initial_custodian_name' => $incidentData['initial_custodian_name'] ?? null,
                'date_report_submitted' => $incidentData['date_report_submitted'] ?? null,
                'created_by' => $user->id,
            ]);

            foreach ($assetsData as $assetData) {
                $assetData['incident_id'] = $incident->id;
                $assetData['has_claimant'] = $incident->has_claimant;
                $this->createAsset->execute($assetData, $user, issueReceipt: false);
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
            AssetMode::TurnedOver => 'TO',
            default => 'AP',
        };

        return $prefix.'-'.$year.'-'.str_pad((string) $sequence, 5, '0', STR_PAD_LEFT);
    }
}