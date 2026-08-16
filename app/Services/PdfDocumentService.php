<?php

namespace App\Services;

use App\Models\AcknowledgementReceipt;
use App\Models\Asset;
use App\Models\AssetPiece;
use App\Models\Disposal;
use App\Models\IcsRecord;
use App\Models\Jev;
use App\Models\ParRecord;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class PdfDocumentService
{
    public function __construct(
        protected QrCodeService $qrCodeService,
    ) {
        $this->ensurePdfEnvironment();
    }

    public function generateAcknowledgementReceipt(Asset $asset, AcknowledgementReceipt $receipt): string
    {
        $pdf = Pdf::loadView('pdf.acknowledgement-receipt', [
            'asset' => $asset,
            'receipt' => $receipt,
        ]);

        $path = $this->storePdf($pdf->output(), 'receipts', $receipt->receipt_number);

        $receipt->update(['pdf_path' => $path]);

        return $path;
    }

    public function generateJev(Asset $asset, Jev $jev): string
    {
        $pdf = Pdf::loadView('pdf.jev', [
            'asset' => $asset,
            'jev' => $jev,
        ]);

        $path = $this->storePdf($pdf->output(), 'jevs', $jev->jev_number);
        $jev->update(['pdf_path' => $path]);

        return $path;
    }

    public function generateDecayReport(Asset $asset, Disposal $disposal): string
    {
        $pdf = Pdf::loadView('pdf.decay-report', [
            'asset' => $asset,
            'disposal' => $disposal,
        ]);

        $path = $this->storePdf($pdf->output(), 'disposals', 'decay-'.$asset->asset_code);
        $disposal->update(['report_pdf_path' => $path]);

        return $path;
    }

    /**
     * Deed of Donation — one PDF per donation, listing every asset that
     * belongs to it as its own row in the asset table.
     *
     * $disposals is always a collection (never a bare Asset/Disposal pair):
     * for a plain single-asset donation it holds exactly one Disposal; for
     * a batch donation (several assets/pieces donated together) it holds
     * every Disposal that shares the same donation_batch_id. This is what
     * lets one call cover both flows without generating a separate PDF per
     * asset.
     *
     * The resulting file path is written back onto every Donation record
     * tied to the disposals passed in, so the combined PDF resolves
     * correctly no matter which asset's page the user opens it from.
     */
    public function generateDeedOfDonation(\Illuminate\Support\Collection $disposals, \App\Models\Donation $donation): string
    {
        $disposals = $disposals->map(function (Disposal $disposal) {
            return $disposal->relationLoaded('asset') ? $disposal : tap($disposal)->load('asset');
        });

        $primaryAsset = $disposals->first()->asset;

        $pdf = Pdf::loadView('pdf.deed-of-donation', [
            'disposals' => $disposals,
            'donation' => $donation,
        ]);

        $path = $this->storePdf($pdf->output(), 'donations', 'deed-'.$primaryAsset->asset_code);

        \App\Models\Donation::whereIn('disposal_id', $disposals->pluck('id'))
            ->update(['deed_of_donation_path' => $path]);

        return $path;
    }

    public function generateAssetTagStickers(Asset $asset): string
    {
        $totalPieces = max(1, (int) ($asset->quantity ?? 1));

        $existing = AssetPiece::query()
            ->where('asset_id', $asset->id)
            ->orderBy('piece_number')
            ->get();

        if ($existing->count() < $totalPieces) {
            for ($i = 1; $i <= $totalPieces; $i++) {
                AssetPiece::firstOrCreate(
                    ['asset_id' => $asset->id, 'piece_number' => $i],
                    ['qr_code_token' => $this->qrCodeService->generateToken()]
                );
            }

            // reload
            $existing = AssetPiece::query()
                ->where('asset_id', $asset->id)
                ->orderBy('piece_number')
                ->get();
        }

        $qrPngDataUris = [];
        foreach ($existing as $pieceRow) {
            $payload = $this->qrCodeService->buildScanUrl($pieceRow->qr_code_token);
            $qrPngDataUris[$pieceRow->piece_number] = $this->qrCodeService->generatePngDataUri($payload);
        }

        $pdf = Pdf::loadView('pdf.asset-tag-stickers', [
            'asset' => $asset->loadMissing('incident'),
            'qrPngDataUris' => $qrPngDataUris,
            'totalPieces' => $totalPieces,
        ]);

        return $this->storePdf($pdf->output(), 'stickers', 'stickers-'.$asset->asset_code);
    }

    /**
     * Donation waybill — a shipping-label-style document affixed to the
     * physical item(s) being released to a donee. One page is generated
     * per unit of the asset's quantity (e.g. "PIECE 2 / 5"), each page
     * carrying the same QR code back to the asset's live record.
     */
    public function generateDonationWaybill(Asset $asset, Disposal $disposal, \App\Models\Donation $donation): string
    {
        $qrPayload = $this->qrCodeService->buildScanUrl($asset->qr_code_token);
        $qrPngDataUri = $this->qrCodeService->generatePngDataUri($qrPayload);
        $totalPieces = max(1, (int) ($asset->quantity ?? 1));

        $pdf = Pdf::loadView('pdf.donation-waybill', [
            'asset' => $asset,
            'disposal' => $disposal,
            'donation' => $donation,
            'qrPngDataUri' => $qrPngDataUri,
            'totalPieces' => $totalPieces,
            'maskedRequesterName' => $this->maskName($donation->requester_name),
        ]);

        $path = $this->storePdf($pdf->output(), 'donations', 'waybill-'.$asset->asset_code);
        $donation->update(['waybill_pdf_path' => $path]);

        return $path;
    }

    public function generateReleaseOrder(Asset $asset, Disposal $disposal, \App\Models\Donation $donation): string
    {
        $pdf = Pdf::loadView('pdf.release-order', [
            'asset' => $asset,
            'disposal' => $disposal,
            'donation' => $donation,
            'disposalJev' => $disposal->disposalJev,
        ]);

        $path = $this->storePdf($pdf->output(), 'release-orders', 'release-order-'.$asset->asset_code);

        $donation->update(['release_order_pdf_path' => $path]);

        return $path;
    }

    public function generateIcs(Asset $asset, IcsRecord $ics): string
    {
        $pdf = Pdf::loadView('pdf.ics', [
            'asset' => $asset,
            'ics' => $ics,
        ]);

        $path = $this->storePdf($pdf->output(), 'ics', $ics->document_number);
        $ics->update(['pdf_path' => $path]);

        return $path;
    }

    public function generatePar(Asset $asset, ParRecord $par): string
    {
        $pdf = Pdf::loadView('pdf.par', [
            'asset' => $asset,
            'par' => $par,
        ]);

        $path = $this->storePdf($pdf->output(), 'par', $par->document_number);
        $par->update(['pdf_path' => $path]);

        return $path;
    }

    public function generateComplianceReport(array $data): string
    {
        $pdf = Pdf::loadView('pdf.compliance-report', $data);

        return $this->storePdf($pdf->output(), 'reports', 'compliance-'.now()->format('Y-m-d-His'));
    }

    /**
     * Confiscation Order — generated automatically for abandoned intakes
     * (mode = Abandoned), per DAO 97-32's automatic confiscation rule.
     */
    public function generateConfiscationOrder(Asset $asset): string
    {
        $pdf = Pdf::loadView('pdf.confiscation-order', [
            'asset' => $asset,
        ]);

        return $this->storePdf($pdf->output(), 'orders', 'confiscation-'.$asset->asset_code);
    }

    /**
     * Forfeiture Order — generated at intake when MES flags an apprehended
     * or turned-over asset as having a confiscation/forfeiture order,
     * distinct from the automatic Confiscation Order for abandoned items.
     */
    public function generateForfeitureOrder(Asset $asset): string
    {
        $pdf = Pdf::loadView('pdf.forfeiture-order', [
            'asset' => $asset,
        ]);

        return $this->storePdf($pdf->output(), 'orders', 'forfeiture-'.$asset->asset_code);
    }

    /**
     * Vehicle released back to the owner after a timely 15-day appeal.
     */
    public function generateVehicleRelease(Asset $asset, Disposal $disposal): string
    {
        $pdf = Pdf::loadView('pdf.vehicle-release', [
            'asset' => $asset,
            'disposal' => $disposal,
        ]);

        $path = $this->storePdf($pdf->output(), 'disposals', 'release-'.$asset->asset_code);
        $disposal->update(['report_pdf_path' => $path]);

        return $path;
    }

    /**
     * Vehicle forfeited in favor of the government (no timely appeal, or
     * by decision of the court/regional office).
     */
    public function generateVehicleForfeiture(Asset $asset, Disposal $disposal): string
    {
        $pdf = Pdf::loadView('pdf.vehicle-forfeiture', [
            'asset' => $asset,
            'disposal' => $disposal,
        ]);

        $path = $this->storePdf($pdf->output(), 'disposals', 'forfeiture-'.$asset->asset_code);
        $disposal->update(['report_pdf_path' => $path]);

        return $path;
    }

    protected function maskName(?string $name): string
    {
        if (! $name) {
            return 'N/A';
        }

        return collect(preg_split('/\s+/', trim($name)))
            ->filter()
            ->map(function (string $word) {
                $length = mb_strlen($word);

                if ($length <= 2) {
                    return $word;
                }

                return mb_substr($word, 0, 2).str_repeat('*', min($length - 2, 4));
            })
            ->implode(' ');
    }

    protected function storePdf(string $content, string $folder, string $basename): string
    {
        $filename = Str::slug($basename).'-'.now()->format('YmdHis').'.pdf';
        $path = "documents/{$folder}/{$filename}";

        Storage::disk('local')->put($path, $content);

        return $path;
    }

    protected function ensurePdfEnvironment(): void
    {
        // Never trust sys_get_temp_dir() here — on this Windows setup it can
        // resolve to C:\WINDOWS itself (not a writable temp subfolder), which
        // breaks dompdf's fwrite() calls. Always use a fixed folder inside the
        // project instead, outside any OneDrive-synced path.
        $tempDir = storage_path('app/dompdf-tmp');
        $fontDir = storage_path('fonts');
        $fontCache = storage_path('fonts');

        foreach ([$tempDir, $fontDir, $fontCache] as $directory) {
            if (! File::isDirectory($directory)) {
                File::ensureDirectoryExists($directory, 0775, true);
            }
        }

        config([
            'dompdf.options.temp_dir' => $tempDir,
            'dompdf.temp_dir' => $tempDir,
            'dompdf.options.font_dir' => $fontDir,
            'dompdf.font_dir' => $fontDir,
            'dompdf.options.font_cache' => $fontCache,
            'dompdf.font_cache' => $fontCache,
        ]);
    }
}