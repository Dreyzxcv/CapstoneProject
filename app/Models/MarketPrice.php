<?php
// app/Models/MarketPrice.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MarketPrice extends Model
{
    public const WHOLE_YEAR = 0;

    public const MONTH_LABELS = [
        0 => 'Whole Year',
        1 => 'January', 2 => 'February', 3 => 'March', 4 => 'April',
        5 => 'May', 6 => 'June', 7 => 'July', 8 => 'August',
        9 => 'September', 10 => 'October', 11 => 'November', 12 => 'December',
    ];

    protected $fillable = [
        'species',
        'year',
        'month',
        'price_per_bd_ft',
    ];

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'month' => 'integer',
            'price_per_bd_ft' => 'decimal:4',
        ];
    }

    public function getMonthLabelAttribute(): string
    {
        return self::MONTH_LABELS[$this->month] ?? 'Whole Year';
    }
}