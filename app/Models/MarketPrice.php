<?php
// app/Models/MarketPrice.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MarketPrice extends Model
{
    protected $fillable = [
        'species',
        'year',
        'price_per_bd_ft',
    ];

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'price_per_bd_ft' => 'decimal:4',
        ];
    }
}