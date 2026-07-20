<?php

namespace App\Http\Controllers;

use App\Http\Requests\QrScanRequest;
use App\Models\Asset;
use App\Models\QrScan;
use App\Services\AuditLogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class QrScanController extends Controller
{
    public function index(): Response
    {
        $this->authorize('viewAny', Asset::class);

        return Inertia::render('Scan/Index');
    }

    public function resolve(Request $request, string $token): Response
    {
        if (! $request->hasValidSignature()) {
            abort(403, 'Invalid or expired QR code.');
        }

        $asset = Asset::where('qr_code_token', $token)->firstOrFail();

        // Auth and active-account checks are handled by the route's
        // middleware group ('auth', 'verified', 'active') before this
        // method ever runs.
        $this->authorize('view', $asset);

        return Inertia::render('Scan/Result', [
            'asset' => $asset->load(['acknowledgementReceipt', 'statusHistory.changedBy']),
            'token' => $token,
        ]);
    }

    public function store(QrScanRequest $request, AuditLogService $auditLog): RedirectResponse
    {
        $asset = Asset::where('qr_code_token', $request->validated('token'))->firstOrFail();

        $this->authorize('view', $asset);

        QrScan::create([
            'asset_id' => $asset->id,
            'scanned_by' => $request->user()->id,
            'scan_location_note' => $request->validated('scan_location_note'),
            'resulting_status' => $asset->current_status,
            'scanned_at' => now(),
        ]);

        $auditLog->log('qr.scanned', $asset, null, [
            'token' => substr($request->validated('token'), 0, 8).'...',
            'location' => $request->validated('scan_location_note'),
        ]);

        return back()->with('success', 'QR scan logged successfully.');
    }
}