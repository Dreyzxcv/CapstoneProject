<?php

namespace App\Http\Controllers;

use App\Actions\IssueJev;
use App\Actions\UploadJev;
use App\Http\Requests\StoreJevRequest;
use App\Http\Requests\UploadJevRequest;
use App\Models\Asset;
use App\Models\Jev;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Support\Facades\Gate;

class JevController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', Jev::class);

        $jevs = Jev::with(['asset.incident'])
            ->latest()
            ->paginate(25);

        return Inertia::render('Jev/Index', [
            'jevs' => $jevs,
        ]);
    }

    public function store(StoreJevRequest $request, Asset $asset, IssueJev $issueJev): RedirectResponse
    {
        $this->authorize('create', Jev::class);

        $issueJev->execute($asset, $request->validated(), $request->user());

        return back()->with('success', 'JEV created and linked to asset.');
    }

    public function upload(UploadJevRequest $request, Asset $asset, UploadJev $uploadJev): RedirectResponse
    {
        $asset->loadMissing('jev');

        abort_if($asset->jev === null, 404, 'No JEV has been issued for this asset yet.');

        $this->authorize('upload', $asset->jev);

        $uploadJev->execute($asset, $asset->jev, $request->user());

        return back()->with('success', 'JEV uploaded. Asset moved to disposal processing.');
    }

    public function show(Request $request, Asset $asset): Response
    {
        $this->authorize('view', $asset);

        $asset->load(['incident']);

        $jev = $asset->jev;

        return Inertia::render('Jev/Show', [
            'asset'              => $asset,
            'jev'                => $jev,
            'appeal_window_open' => $jev?->appeal_window_open ?? false,
            'appeal_deadline'    => $jev?->appeal_deadline?->toDateString(),
            'can'                => [
                'issue_jev'  => $request->user()->can('issue', [Jev::class, $asset]),
                'upload_jev' => $jev && $request->user()->can('upload', $jev),
                'store_jev'  => $jev && $request->user()->can('store', $jev),
            ],
        ]);
    }
}