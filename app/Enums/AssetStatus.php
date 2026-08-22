<?php

namespace App\Enums;

enum AssetStatus: string
{
    case IntakeRecorded = 'intake_recorded';
    case DocumentsUploaded = 'documents_uploaded';
    case PendingCustodyReview = 'pending_custody_review';
    case ReceiptSigned = 'receipt_signed';
    case Stored = 'stored';
    case UnderTrial = 'under_trial';
    case ClearedForAccounting = 'cleared_for_accounting';
    case ForDisposal = 'for_disposal';
    case DonationPendingJevOut = 'donation_pending_jev_out';
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
            self::DocumentsUploaded => 'Documents Uploaded',
            self::PendingCustodyReview => 'Pending Custody Review',
            self::ReceiptSigned => 'Receipt Signed',
            self::Stored => 'In Storage',
            self::UnderTrial => 'Under Trial',
            self::ClearedForAccounting => 'Cleared for Accounting',
            self::ForDisposal => 'For Disposal',
            self::DonationPendingJevOut => 'Donation — Awaiting JEV Out',
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
            self::IntakeRecorded            => 'default',
            self::DocumentsUploaded         => 'blue',
            self::PendingCustodyReview      => 'amber',
            self::ReceiptSigned             => 'cyan',
            self::Stored                    => 'teal',
            self::UnderTrial                => 'purple',
            self::ClearedForAccounting      => 'indigo',
            self::ForDisposal               => 'orange',
            self::DonationPendingJevOut     => 'yellow',
            self::PendingRelease            => 'yellow',
            self::Donated                   => 'green',
            self::Fabricated                => 'green',
            self::Released                  => 'green',
            self::Decayed                   => 'red',
            self::Forfeited                 => 'rose',
            self::Damaged                   => 'red',
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
