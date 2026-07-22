<?php

namespace App\Enums;

enum DisposalType: string
{
    case Donation = 'donation';
    case Decayed = 'decayed';
    case Fabricated = 'fabricated';
    case Released = 'released';
    case Forfeited = 'forfeited';
    case Damaged = 'damaged';

    public function label(): string
    {
        return match ($this) {
            self::Donation => 'Donation',
            self::Decayed => 'Decayed',
            self::Fabricated => 'Fabricated',
            self::Released => 'Released to Owner',
            self::Forfeited => 'Forfeited',
            self::Damaged => 'Damaged / Disabled',
        };
    }

    public function resultingStatus(): AssetStatus
    {
        return match ($this) {
            self::Donation => AssetStatus::PendingRelease,
            self::Decayed => AssetStatus::Decayed,
            self::Fabricated => AssetStatus::Fabricated,
            self::Released => AssetStatus::Released,
            self::Forfeited => AssetStatus::Forfeited,
            self::Damaged => AssetStatus::Damaged,
        };
    }
}
