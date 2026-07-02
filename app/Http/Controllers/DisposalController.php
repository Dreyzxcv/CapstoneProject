<?php

namespace App\Http\Controllers;

use App\Actions\ProcessDisposal;
use App\Actions\ReleaseDonation;
use App\Enums\DisposalType;
use App\Http\Requests\ProcessDisposalRequest;
use App\Models\Asset;
use App\Models\Disposal;
use App\Services\AssetLifecycleService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class DisposalController extends Controller
{
    public function index(): Response
    {
        $this->authorize('create', Disposal::class);

        $assets = Asset::query()
            ->where('current_status', 'for_disposal')
            ->with(['jev', 'creator'])
            ->latest()
            ->paginate(15);

        return Inertia::render('Disposals/Index', [
            'assets' => $assets,
        ]);
    }

    public function create(Asset $asset, AssetLifecycleService $lifecycle): Response
    {
        $this->authorize('create', Disposal::class);
        $this->authorize('view', $asset);

        return Inertia::render('Disposals/Create', [
            'asset' => $asset->load(['jev']),
            'disposalTypes' => collect($lifecycle->allowedDisposalTypes($asset))->map(fn ($t) => [
                'value' => $t->value,
                'label' => $t->label(),
            ]),
        ]);
    }

    public function store(ProcessDisposalRequest $request, Asset $asset, ProcessDisposal $processDisposal): RedirectResponse
    {
        $this->authorize('create', Disposal::class);

        $type = DisposalType::from($request->validated('disposal_type'));
        $details = array_filter([
            'requester_name' => $request->validated('requester_name'),
            'notes' => $request->validated('notes'),
            'appeal_filed' => $request->boolean('appeal_filed'),
            'appeal_deadline' => $asset->appeal_deadline?->toIso8601String(),
        ], fn ($value) => $value !== null && $value !== '');

        $processDisposal->execute($asset, $type, $request->user(), $details);

        return redirect()->route('assets.show', $asset)
            ->with('success', 'Disposal processed successfully.');
    }

    public function releaseDonation(Disposal $disposal, ReleaseDonation $releaseDonation): RedirectResponse
    {
        $this->authorize('create', Disposal::class);

        $releaseDonation->execute($disposal, request()->user());

        return back()->with('success', 'Donation marked as released.');
    }
}
