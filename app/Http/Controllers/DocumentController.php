<?php

namespace App\Http\Controllers;

use App\Models\AcknowledgementReceipt;
use App\Models\Asset;
use App\Models\Disposal;
use App\Models\Document;
use App\Models\IcsRecord;
use App\Models\Jev;
use App\Models\ParRecord;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Http\Requests\UploadRequiredDocumentRequest;
use App\Http\Requests\VerifyDocumentRequest;
use App\Services\AuditLogService;
use App\Http\Requests\UploadEvidenceRequest;
use Illuminate\Http\RedirectResponse;
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

        $downloadName = $this->resolveDownloadName($decodedPath);

        $mimeType = Storage::disk('local')->mimeType($decodedPath);
        $isPreviewable = str_starts_with((string) $mimeType, 'image/') || $mimeType === 'application/pdf';


        return Storage::disk('local')->download($decodedPath, $downloadName, $isPreviewable
         ? ['Content-Disposition' => 'inline']
         : []);
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

            str_starts_with($path, 'documents/donations/release-photos/') =>
                \App\Models\Donation::where('release_photo_path', $path)->first()?->disposal?->asset,

            str_starts_with($path, 'documents/donations/') && str_contains($path, '/waybill-') =>
                \App\Models\Donation::where('waybill_pdf_path', $path)->first()?->disposal?->asset,

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

    protected function resolveDownloadName(string $path): ?string
    {
        return Document::where('file_path', $path)->value('original_name');
    }

    public function store(UploadEvidenceRequest $request, Asset $asset): RedirectResponse
    {
        $this->authorize('view', $asset);

        foreach ($request->file('photos', []) as $file) {
            $path = $file->store("documents/evidence/{$asset->id}", 'local');

            Document::create([
                'attachable_type' => Asset::class,
                'attachable_id' => $asset->id,
                'file_path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getClientMimeType(),
                'uploaded_by' => $request->user()->id,
                'uploaded_at' => now(),
            ]);
        }

        return back()->with('success', 'Evidence photo(s) uploaded.');
    }

    public function storeRequired(UploadRequiredDocumentRequest $request, Asset $asset): RedirectResponse
    {
        $this->authorize('view', $asset);

        $file = $request->file('file');
        $type = DocumentType::from($request->validated('document_type'));

        $path = $file->store("documents/required/{$asset->id}", 'local');

        Document::create([
            'attachable_type' => Asset::class,
            'attachable_id' => $asset->id,
            'document_type' => $type,
            'file_path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getClientMimeType(),
            'status' => DocumentStatus::Pending,
            'uploaded_by' => $request->user()->id,
            'uploaded_at' => now(),
        ]);

        return back()->with('success', "{$type->label()} uploaded for review.");
    }

    public function verify(VerifyDocumentRequest $request, Document $document, AuditLogService $auditLog): RedirectResponse
    {
        $this->authorize('verify', $document);

        $before = $document->only(['status', 'remarks']);
        $decision = $request->validated('decision');

        $document->update([
            'status' => $decision,
            'remarks' => $decision === 'rejected' ? $request->validated('remarks') : null,
            'verified_by' => $request->user()->id,
            'verified_at' => now(),
        ]);

        $auditLog->log(
            $decision === 'verified' ? 'document.verified' : 'document.rejected',
            $document,
            $before,
            $document->fresh()->only(['status', 'remarks']),
            $request->user()->id,
        );

        return back()->with('success', $decision === 'verified'
            ? 'Document marked as verified.'
            : 'Document rejected and sent back to MES with remarks.');
    }
}