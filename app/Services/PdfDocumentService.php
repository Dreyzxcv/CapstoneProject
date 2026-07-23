<?php

namespace App\Services;

use App\Models\AcknowledgementReceipt;
use App\Models\Asset;
use App\Models\Disposal;
use App\Models\IcsRecord;
use App\Models\Jev;
use App\Models\ParRecord;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PdfDocumentService
{
    public function __construct(
        protected QrCodeService $qrCodeService,
    ) {}

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

    public function generateDeedOfDonation(Asset $asset, Disposal $disposal, \App\Models\Donation $donation): string
    {
        $pdf = Pdf::loadView('pdf.deed-of-donation', [
            'asset' => $asset,
            'disposal' => $disposal,
            'donation' => $donation,
            'requesterName' => $donation->requester_name,
        ]);

        $path = $this->storePdf($pdf->output(), 'donations', 'deed-'.$asset->asset_code);

        $donation->update(['deed_of_donation_path' => $path]);

        return $path;
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

        // Use the PNG data-URI form here, not generateSvg(). dompdf's SVG
        // renderer relies on the element having explicit width/height
        // attributes to size itself — viewBox-only sizing (what the QR
        // library emits) renders at zero size or is silently dropped.
        // The acknowledgement receipt sidesteps the same class of issue by
        // embedding its letterhead logos as base64 <img> tags; PNG QR +
        // <img> is the equivalent fix here.
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
}