<?php
// app/Actions/CreateIncidentWithAssets.php

namespace App\Actions;

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
            $incident = Incident::create([
                'incident_code' => $this->generateIncidentCode(),
                'date_of_apprehension' => $incidentData['date_of_apprehension'],
                'place_of_apprehension' => $incidentData['place_of_apprehension'],
                'area' => $incidentData['area'] ?? null,
                'coordinates' => $incidentData['coordinates'] ?? null,
                'claimant_offender_name' => $incidentData['claimant_offender_name'] ?? null,
                'is_abandoned' => $incidentData['is_abandoned'] ?? false,
                'apprehending_party' => $incidentData['apprehending_party'],
                'date_report_submitted' => $incidentData['date_report_submitted'] ?? null,
                'created_by' => $user->id,
            ]);

            foreach ($assetsData as $assetData) {
                $assetData['incident_id'] = $incident->id;
                $this->createAsset->execute($assetData, $user);
            }

            $this->auditLogService->log('incident.created', $incident, null, $incident->toArray(), $user->id);

            return $incident->fresh('assets');
        });
    }

    protected function generateIncidentCode(): string
    {
        return 'INC-'.now()->format('Y').'-'.strtoupper(Str::random(6));
    }
}