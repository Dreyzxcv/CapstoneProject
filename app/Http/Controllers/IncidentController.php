<?php
// app/Http/Controllers/IncidentController.php

namespace App\Http\Controllers;

use App\Actions\CreateIncidentWithAssets;
use App\Enums\AssetMode;
use App\Enums\AssetType;
use App\Enums\Municipality;
use App\Http\Requests\StoreIncidentRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class IncidentController extends Controller
{
    public function create(Request $request): Response
    {
        abort_unless($request->user()?->can('incidents.create'), 403);

        return Inertia::render('Incidents/Create', [
            'types' => collect(AssetType::cases())->map(fn ($t) => [
                'value' => $t->value,
                'label' => $t->label(),
            ]),
            'modes' => collect(AssetMode::cases())->map(fn ($m) => [
                'value' => $m->value,
                'label' => $m->label(),
            ]),
            'municipalities' => collect(Municipality::cases())->map(fn ($m) => [
                'value' => $m->value,
                'label' => $m->value,
            ]),
        ]);
    }

    public function store(StoreIncidentRequest $request, CreateIncidentWithAssets $createIncident): RedirectResponse
    {
        $validated = $request->validated();

        $incident = $createIncident->execute(
            collect($validated)->except('assets')->all(),
            $validated['assets'],
            $request->user(),
        );

        $firstAsset = $incident->assets->first();

        return redirect()->route('assets.show', $firstAsset)
            ->with('success', "Incident {$incident->incident_code} recorded with {$incident->assets->count()} asset(s).");
    }
}