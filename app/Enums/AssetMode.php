<?php

namespace App\Enums;

enum AssetMode: string
{
    case Apprehended = 'apprehended';
    case TurnedOver = 'turned_over';

    public function label(): string
    {
        return match ($this) {
            self::Apprehended => 'Apprehended',
            self::TurnedOver => 'Turned Over',
        };
    }
}