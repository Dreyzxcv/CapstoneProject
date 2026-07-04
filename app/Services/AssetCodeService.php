<?php

namespace App\Services;

use App\Enums\Municipality;
use App\Models\Asset;

class AssetCodeService
{
    protected const string REGION_CODE = '5';   // Region V
    protected const string PROVINCE_CODE = 'C'; // Catanduanes

    public function generate(Asset $asset, Municipality $municipality, bool $hasOngoingCase): string
    {
        $statusCode = $hasOngoingCase ? 'OT' : 'CN';
        $sequence = str_pad((string) $asset->id, 5, '0', STR_PAD_LEFT);

        return self::REGION_CODE.self::PROVINCE_CODE.$municipality->code().'-'.$statusCode.'-'.$sequence;
    }
}