<?php
// app/Actions/UpdateCaseDetails.php

namespace App\Actions;

use App\Models\Asset;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\AssetInfoHistoryService;
use DomainException;

class UpdateCaseDetails
{
    public function __construct(
        protected AuditLogService $auditLogService,
        protected AssetInfoHistoryService $historyService,
    ) {}

    public function execute(Asset $asset, array $data, User $user): Asset
    {
        if (! $asset->has_ongoing_case) {
            throw new DomainException('This asset does not have an ongoing case.');
        }

        $tracked = ['case_number', 'court_branch', 'next_hearing_date', 'case_outcome'];
        $before  = $asset->only($tracked);

        $asset->update([
            'case_number' => $data['case_number'] ?? $asset->case_number,
            'court_branch' => $data['court_branch'] ?? $asset->court_branch,
            'next_hearing_date' => $data['next_hearing_date'] ?? $asset->next_hearing_date,
            'case_outcome' => $data['case_outcome'] ?? $asset->case_outcome,
        ]);

        $fresh = $asset->fresh();
        $after = $fresh->only($tracked);

        $this->historyService->record($fresh, $this->historyService->diff($before, $after, [
            'case_number'       => 'Case number',
            'court_branch'      => 'Court / branch',
            'next_hearing_date' => 'Next hearing date',
            'case_outcome'      => 'Case outcome',
        ]), $user->id);

        $this->auditLogService->log('asset.case_details_updated', $asset, $before, $after, $user->id);

        return $fresh;
    }
}