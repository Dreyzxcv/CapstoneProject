<?php

namespace App\Http\Controllers;

use App\Actions\IssueJev;
use App\Http\Requests\StoreJevRequest;
use App\Models\Disposal;
use App\Models\Asset;
use App\Models\Jev;
use App\Enums\AssetStatus;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class JevController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', Jev::class);

        $jevs = Jev::latest()->paginate(25);

        $pendingAssets = Asset::where('current_status', AssetStatus::ClearedForAccounting)
            ->whereNotExists(function ($query) {
                $query->selectRaw(1)
                    ->from('jevs')
                    ->whereColumn('jevs.asset_code', 'assets.asset_code')
                    ->whereColumn('jevs.asset_type', 'assets.type');
            })
            ->latest()
            ->get(['id', 'asset_code', 'aap_number', 'type', 'current_status'])
            ->unique(fn ($a) => $a->asset_code . '-' . ($a->type instanceof \App\Enums\AssetType ? $a->type->value : $a->type))
            ->values();

        $disposalsAwaitingJevOut = \App\Models\Donation::query()
            ->whereHas('disposals', fn ($q) => $q->whereDoesntHave('disposalJev'))
            ->with(['disposals' => fn ($q) => $q->with('asset')])
            ->latest()
            ->get();

        return Inertia::render('Jev/Index', [
            'jevs'                    => $jevs,
            'pendingAssets'           => $pendingAssets,
            'disposalsAwaitingJevOut' => $disposalsAwaitingJevOut,
        ]);
    }

    public function showDisposalJev(Disposal $disposal): Response
    {
        $this->authorize('viewAny', Jev::class);

        $disposal->load(['disposalJev', 'donation']);

        $siblingsWithAssets = $disposal->donation
            ? \App\Models\Disposal::where('donation_id', $disposal->donation->id)
                ->with(['asset', 'asset.pieces' => fn($q) => $q->whereIn('disposal_id', 
                    \App\Models\Disposal::where('donation_id', $disposal->donation->id)->pluck('id')
                )])
                ->get()
            : collect();

        return Inertia::render('Jev/ShowDisposalJev', [
            'disposal'  => $disposal,
            'siblings'  => $siblingsWithAssets,
            'can' => [
                'issue_jev_out' => request()->user()->can('jev.create'),
            ],
        ]);
    }

    public function store(StoreJevRequest $request, Asset $asset, IssueJev $issueJev): RedirectResponse
    {
        $this->authorize('create', Jev::class);

        $issueJev->execute($asset, $request->validated(), $request->user());

        return back()->with('success', 'JEV issued successfully.');
    }

    public function show(Request $request, Asset $asset): Response
    {
        $this->authorize('view', $asset);

        $asset->load(['incident', 'pieces']);

        $jev = $asset->jev;

        return Inertia::render('Jev/Show', [
            'asset' => $asset,
            'jev'   => $jev,
            'can'   => [
                'issue_jev' => $request->user()->can('create', Jev::class),
            ],
        ]);
    }
}