<?php
// app/Enums/DonationOrganizationType.php

namespace App\Enums;

enum DonationOrganizationType: string
{
    case Academe = 'academe';
    case NationalAgency = 'national_agency';
    case Lgu = 'lgu';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Academe => 'Academe',
            self::NationalAgency => 'National Agency',
            self::Lgu => 'LGU',
            self::Other => 'Other',
        };
    }
}