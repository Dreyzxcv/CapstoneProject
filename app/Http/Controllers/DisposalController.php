<?php

namespace App\Http\Controllers;

use App\Actions\ProcessDisposal;
use App\Actions\ReleaseDonation;
use App\Enums\DisposalType;
use App\Enums\Municipality;
use App\Http\Requests\ProcessDisposalRequest;
use App\Models\Asset;
use App\Models\Disposal;
use App\Services\AssetLifecycleService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\Request;

class DisposalController extends Controller
{
    public function index(): Response
    {
        $this->authorize('viewAny', Disposal::class);

        $assets = Asset::query()
            ->where('current_status', 'for_disposal')
            ->with(['jev', 'creator'])
            ->latest()
            ->paginate(15);

        return Inertia::render('Disposals/Index', [
            'assets' => $assets,
            'can' => [
                'process' => request()->user()->can('create', Disposal::class),
            ],
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
            'municipalities' => collect(Municipality::cases())->map(fn ($m) => [
                'value' => $m->value,
                'label' => $m->value,
            ]),
            'barangaysByMunicipality' => config('barangays'),
        ]);
    }

    public function store(ProcessDisposalRequest $request, Asset $asset, ProcessDisposal $processDisposal): RedirectResponse
    {
        $this->authorize('create', Disposal::class);

        $type = DisposalType::from($request->validated('disposal_type'));
        $details = array_filter([
            'requester_name' => $request->validated('requester_name'),
            'organization_type' => $request->validated('organization_type'),
            'organization_type_other' => $request->validated('organization_type_other'),
            'agency_name' => $request->validated('agency_name'),
            'municipality' => $request->validated('municipality'),
            'barangay' => $request->validated('barangay'),
            'street' => $request->validated('street'),
            'notes' => $request->validated('notes'),
            'appeal_filed' => $request->boolean('appeal_filed'),
            'appeal_deadline' => $asset->appeal_deadline?->toIso8601String(),
            'delivery_coordinates' => $request->validated('delivery_coordinates'),
        ], fn ($value) => $value !== null && $value !== '');

        $processDisposal->execute(
            $asset,
            $type,
            $request->user(),
            $details,
            $request->validated('quantity'),
        );

        return redirect()->route('assets.show', $asset)
            ->with('success', 'Disposal processed successfully.');
    }

    public function releaseDonation(Request $request, Disposal $disposal, ReleaseDonation $releaseDonation): RedirectResponse
    {
        $this->authorize('create', Disposal::class);

        $request->validate(['photo' => ['nullable', 'file', 'image', 'max:8192']]);

        $releaseDonation->execute($disposal, $request->user(), $request->file('photo'));

        return back()->with('success', 'Donation marked as released.');
    }
}