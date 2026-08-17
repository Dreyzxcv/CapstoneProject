<?php

namespace App\Services;

use App\Enums\AssetMode;
use App\Enums\Municipality;
use App\Models\Asset;

class AssetCodeService
{
    public function generate(Asset $asset, Municipality $municipality, bool $hasOngoingCase): string
    {
        $year = $asset->incident?->date_report_submitted?->format('Y') ?? now()->format('Y');

        // Every asset under the same incident gets the SAME AAP No. now.
        $sequence = $asset->incident_id
            ? str_pad((string) $asset->incident_id, 5, '0', STR_PAD_LEFT)
            : str_pad((string) $asset->id, 5, '0', STR_PAD_LEFT);

        $prefix = match ($asset->mode) {
            AssetMode::Apprehended => 'AP',
            AssetMode::TurnedOver => 'TO',
            default => 'AP',
        };

        return $prefix.'-'.$year.'-'.$sequence;
    }
}