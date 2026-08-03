<?php

namespace App\Actions;

use App\Enums\DisposalType;
use App\Models\Disposal;
use App\Models\DisposalJev;
use App\Models\User;
use App\Services\AuditLogService;
use DomainException;
use Illuminate\Support\Facades\DB;

class IssueDisposalJevOut
{
    public function __construct(
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

        if (! $disposal->donation) {
            throw new DomainException('This disposal has no associated donation.');
        }

        return DB::transaction(function () use ($disposal, $data, $accountingUser) {
            $disposalJev = DisposalJev::create([
                'disposal_id' => $disposal->id,
                'jev_number' => $data['jev_number'],
                'issued_by_accounting_id' => $accountingUser->id,
            ]);

            $this->auditLogService->log('disposal_jev.issued', $disposalJev, null, $disposalJev->toArray(), $accountingUser->id);

            return $disposalJev->fresh();
        });
    }
}