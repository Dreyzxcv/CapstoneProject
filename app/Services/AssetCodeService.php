<?php

namespace App\Services;

use App\Enums\Municipality;
use App\Models\Asset;

class AssetCodeService
{
    public function generate(Asset $asset, Municipality $municipality, bool $hasOngoingCase): string
    {
        $year = $asset->incident?->date_of_apprehension?->format('Y') ?? now()->format('Y');
        $sequence = str_pad((string) $asset->id, 5, '0', STR_PAD_LEFT);

        return 'AAP-FV-'.$year.'-'.$sequence;
    }
}