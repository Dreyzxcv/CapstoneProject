<?php

namespace App\Http\Controllers;

use App\Actions\IssueJev;
use App\Actions\UploadJev;
use App\Http\Requests\StoreJevRequest;
use App\Http\Requests\UploadJevRequest;
use App\Models\Asset;
use Illuminate\Http\RedirectResponse;

class JevController extends Controller
{
    public function store(StoreJevRequest $request, Asset $asset, IssueJev $issueJev): RedirectResponse
    {
        $this->authorize('create', \App\Models\Jev::class);

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
}
