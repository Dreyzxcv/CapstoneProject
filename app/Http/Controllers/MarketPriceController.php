<?php
// app/Http/Controllers/MarketPriceController.php

namespace App\Http\Controllers;

use App\Models\MarketPrice;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MarketPriceController extends Controller
{
    // Kept in sync with the species list on the intake form (Incidents/Create.tsx).
    protected const SPECIES_OPTIONS = [
        'Narra', 'Coco Lumber', 'Mahogany', 'Molave', 'Yakal', 'Ipil',
        'Kamagong', 'Tanguile', 'Lauan', 'Apitong', 'Gmelina', 'Falcata', 'Bamboo',
    ];

    public function index(Request $request): Response
    {
        abort_unless($request->user()?->can('market_prices.manage'), 403);

        return Inertia::render('Settings/MarketPrices/Index', [
            'marketPrices' => MarketPrice::orderByDesc('year')->orderBy('species')->get(),
            'speciesOptions' => self::SPECIES_OPTIONS,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()?->can('market_prices.manage'), 403);

        $validated = $request->validate([
            'species' => ['required', 'string', 'max:255'],
            'year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'price_per_bd_ft' => ['required', 'numeric', 'min:0'],
        ]);

        // updateOrCreate so re-submitting the same species/year edits the existing rate
        // instead of hitting the unique constraint.
        MarketPrice::updateOrCreate(
            ['species' => $validated['species'], 'year' => $validated['year']],
            ['price_per_bd_ft' => $validated['price_per_bd_ft']],
        );

        return back()->with('success', 'Market price saved.');
    }

    public function destroy(Request $request, MarketPrice $marketPrice): RedirectResponse
    {
        abort_unless($request->user()?->can('market_prices.manage'), 403);

        $marketPrice->delete();

        return back()->with('success', 'Market price removed.');
    }
}