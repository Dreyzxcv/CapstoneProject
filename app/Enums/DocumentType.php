<?php

namespace App\Enums;

enum DocumentType: string
{
    case DaoForm = 'dao_form';
    case TallySheet = 'tally_sheet';
    case AapDocument = 'aap_document';
    case ConfiscationOrder = 'confiscation_order';
    case ForfeitureOrder = 'forfeiture_order';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::DaoForm => 'DAO Form',
            self::TallySheet => 'Tally Sheet',
            self::AapDocument => 'AAP (Scanned Document)',
            self::ConfiscationOrder => 'Confiscation Order',
            self::ForfeitureOrder => 'Forfeiture Order',
            self::Other => 'Other Supporting Document',
        };
    }
}