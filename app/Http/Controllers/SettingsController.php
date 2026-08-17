<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        $cards = collect([
            [
                'key' => 'users',
                'title' => 'Users',
                'description' => 'Manage user accounts, roles, and access.',
                'href' => route('users.index'),
                'icon' => 'Users',
                'permission' => 'users.manage',
            ],
            [
                'key' => 'market_prices',
                'title' => 'Market Prices',
                'description' => 'Set species prices per year, with month-specific overrides for seasonal spikes.',
                'href' => route('market-prices.index'),
                'icon' => 'Peso',
                'permission' => 'market_prices.manage',
            ],
            [
                'key' => 'about',
                'title' => 'About',
                'description' => 'App info and development team credits.',
                'href' => route('about'),
                'icon' => 'Info',
                'permission' => null,
            ],
        ])
            ->filter(fn ($card) => $user?->can($card['permission']))
            ->values();

        return Inertia::render('Settings/Index', [
            'cards' => $cards,
        ]);
    }
}