<?php

namespace App\Enums;

enum DocumentType: string
{
    case ConfiscationOrder = 'confiscation_order';
    case ForfeitureOrder = 'forfeiture_order';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::ConfiscationOrder => 'Confiscation Order',
            self::ForfeitureOrder => 'Forfeiture Order',
            self::Other => 'Other Supporting Document',
        };
    }
}