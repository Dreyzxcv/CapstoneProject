<?php

namespace App\Http\Controllers;

use App\Http\Requests\QrScanRequest;
use App\Models\Asset;
use App\Models\AssetPiece;
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

        $assetPiece = AssetPiece::where('qr_code_token', $token)->first();

        if ($assetPiece) {
            $asset = $assetPiece->asset;
            $pieceNumber = $assetPiece->piece_number;
        } else {
            $asset = Asset::where('qr_code_token', $token)->firstOrFail();
            $pieceNumber = null;
        }

        // Auth and active-account checks are handled by the route's
        // middleware group ('auth', 'verified', 'active') before this
        // method ever runs.
        $this->authorize('view', $asset);

        return Inertia::render('Scan/Result', [
            'asset' => $asset->load(['acknowledgementReceipt', 'statusHistory.changedBy']),
            'token' => $token,
            'piece_number' => $pieceNumber,
        ]);
    }

    public function store(QrScanRequest $request, AuditLogService $auditLog): RedirectResponse
    {
        $token = $request->validated('token');

        // Try per-piece first, fall back to asset-level token for legacy codes.
        $assetPiece = AssetPiece::where('qr_code_token', $token)->first();

        if ($assetPiece) {
            $asset = $assetPiece->asset;
            $assetPieceId = $assetPiece->id;
        } else {
            $asset = Asset::where('qr_code_token', $token)->firstOrFail();
            $assetPieceId = null;
        }

        $this->authorize('view', $asset);

        QrScan::create([
            'asset_id' => $asset->id,
            'asset_piece_id' => $assetPieceId,
            'scanned_by' => $request->user()->id,
            'scan_location_note' => $request->validated('scan_location_note'),
            'resulting_status' => $asset->current_status,
            'scanned_at' => now(),
        ]);

        $auditLog->log('qr.scanned', $asset, null, [
            'token' => substr($token, 0, 8).'...',
            'location' => $request->validated('scan_location_note'),
            'asset_piece_id' => $assetPieceId,
        ]);

        return back()->with('success', 'QR scan logged successfully.');
    }
}