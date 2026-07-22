<?php

namespace App\Enums;

enum AssetStatus: string
{
    case IntakeRecorded = 'intake_recorded';
    case PendingCustodyReview = 'pending_custody_review';
    case ReceiptSigned = 'receipt_signed';
    case Stored = 'stored';
    case UnderTrial = 'under_trial';
    case ClearedForAccounting = 'cleared_for_accounting';
    case ForDisposal = 'for_disposal';
    case PendingRelease = 'pending_release';
    case Donated = 'donated';
    case Decayed = 'decayed';
    case Fabricated = 'fabricated';
    case Released = 'released';
    case Forfeited = 'forfeited';
    case Damaged = 'damaged';

    public function label(): string
    {
        return match ($this) {
            self::IntakeRecorded => 'Intake Recorded',
            self::PendingCustodyReview => 'Pending Custody Review',
            self::ReceiptSigned => 'Receipt Signed',
            self::Stored => 'In Storage',
            self::UnderTrial => 'Under Trial',
            self::ClearedForAccounting => 'Cleared for Accounting',
            self::ForDisposal => 'For Disposal',
            self::PendingRelease => 'Pending Release to Donee',
            self::Donated => 'Donated',
            self::Decayed => 'Decayed',
            self::Fabricated => 'Fabricated',
            self::Released => 'Released',
            self::Forfeited => 'Forfeited',
            self::Damaged => 'Damaged / Disabled',
        };
    }

    public function badgeVariant(): string
    {
        return match ($this) {
            self::UnderTrial => 'blue',
            self::PendingCustodyReview, self::ForDisposal, self::ClearedForAccounting, self::PendingRelease => 'amber',
            self::Stored, self::Donated, self::Released, self::Fabricated => 'green',
            self::Forfeited, self::Decayed, self::Damaged => 'gray',
            default => 'default',
        };
    }

    public function isTerminal(): bool
    {
        return in_array($this, [
            self::Donated,
            self::Decayed,
            self::Fabricated,
            self::Released,
            self::Forfeited,
            self::Damaged,
        ], true);
    }
}
