<?php

namespace App\Http\Controllers;

use App\Models\AcknowledgementReceipt;
use App\Models\Asset;
use App\Models\Disposal;
use App\Models\Document;
use App\Models\IcsRecord;
use App\Models\Jev;
use App\Models\ParRecord;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentController extends Controller
{
    public function download(Request $request, string $path): StreamedResponse
    {
        $user = $request->user();
        abort_unless($user, 403);

        $decodedPath = base64_decode($path, true);
        abort_if($decodedPath === false, 404);

        // Reject path traversal / null-byte tricks before doing anything else.
        abort_if(Str::contains($decodedPath, ['..', "\0"]), 404);
        abort_unless(Str::startsWith($decodedPath, 'documents/'), 404);

        abort_unless(Storage::disk('local')->exists($decodedPath), 404);

        $asset = $this->resolveOwningAsset($decodedPath);

        // If we can't determine an owning asset at all, fail closed rather
        // than serve the file to an authenticated-but-unrelated user.
        abort_if($asset === null, 404);

        $this->authorize('view', $asset);

        return Storage::disk('local')->download($decodedPath);
    }

    /**
     * Resolve the Asset a generated or uploaded document belongs to, so we
     * can run it through AssetPolicy::view instead of only checking
     * "is authenticated."
     */
    protected function resolveOwningAsset(string $path): ?Asset
    {
        return match (true) {
            str_starts_with($path, 'documents/receipts/') =>
                AcknowledgementReceipt::where('pdf_path', $path)->first()?->asset,

            str_starts_with($path, 'documents/jevs/') =>
                Jev::where('pdf_path', $path)->first()?->asset,

            str_starts_with($path, 'documents/disposals/') =>
                Disposal::where('report_pdf_path', $path)->first()?->asset,

            str_starts_with($path, 'documents/ics/') =>
                IcsRecord::where('pdf_path', $path)->first()?->disposal?->asset,

            str_starts_with($path, 'documents/par/') =>
                ParRecord::where('pdf_path', $path)->first()?->disposal?->asset,

            str_starts_with($path, 'documents/donations/') =>
                \App\Models\Donation::where('deed_of_donation_path', $path)
                    ->first()?->disposal?->asset,

            default => Document::where('file_path', $path)
                ->first()
                ?->attachable instanceof Disposal
                    ? Document::where('file_path', $path)->first()->attachable->asset
                    : Document::where('file_path', $path)->first()?->attachable,
        };
    }
}