<?php
// app/Actions/UpdateCaseDetails.php

namespace App\Actions;

use App\Models\Asset;
use App\Models\User;
use App\Services\AuditLogService;
use DomainException;

class UpdateCaseDetails
{
    public function __construct(
        protected AuditLogService $auditLogService,
    ) {}

    public function execute(Asset $asset, array $data, User $user): Asset
    {
        if (! $asset->has_ongoing_case) {
            throw new DomainException('This asset does not have an ongoing case.');
        }

        $before = $asset->only(['case_number', 'court_branch', 'next_hearing_date']);

        $asset->update([
            'case_number' => $data['case_number'] ?? $asset->case_number,
            'court_branch' => $data['court_branch'] ?? $asset->court_branch,
            'next_hearing_date' => $data['next_hearing_date'] ?? $asset->next_hearing_date,
        ]);

        $this->auditLogService->log(
            'asset.case_details_updated',
            $asset,
            $before,
            $asset->fresh()->only(['case_number', 'court_branch', 'next_hearing_date']),
            $user->id,
        );

        return $asset->fresh();
    }
}