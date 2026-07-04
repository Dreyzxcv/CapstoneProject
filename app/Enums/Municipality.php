<?php

namespace App\Enums;

enum Municipality: string
{
    case Virac = 'Virac';
    case Bato = 'Bato';
    case SanAndres = 'San Andres';
    case Baras = 'Baras';
    case Bagamanoc = 'Bagamanoc';
    case Caramoran = 'Caramoran';
    case Gigmoto = 'Gigmoto';
    case Pandan = 'Pandan';
    case Panganiban = 'Panganiban';
    case SanMiguel = 'San Miguel';
    case Viga = 'Viga';

    public function code(): string
    {
        return match ($this) {
            self::Virac => '1',
            self::Bato => '2',
            self::SanAndres => '3',
            self::Baras => '4',
            self::Bagamanoc => '5',
            self::Caramoran => '6',
            self::Gigmoto => '7',
            self::Pandan => '8',
            self::Panganiban => '9',
            self::SanMiguel => '10',
            self::Viga => '11',
        };
    }
}