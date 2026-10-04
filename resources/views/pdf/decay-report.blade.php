<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Decay Report — DENR-PENRO Catanduanes</title>

    <style>
        @page {
            margin-top: 1.6in;
            margin-bottom: 1.1in;
            margin-left: 0.6in;
            margin-right: 0.6in;
            size: 8.5in 14in;
        }

        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 11pt;
            color: #000;
            line-height: 1.4;
        }

        /* ── Page header / footer (fixed) ── */
        .page-header {
            position: fixed;
            top: -1.4in;
            left: 0; right: 0;
        }

        .page-footer {
            position: fixed;
            bottom: -1.1in;
            left: 0; right: 0;
            font-size: 9pt;
            font-style: italic;
            border-top: 1pt solid #ccc;
            padding-top: 6pt;
        }

        .header-table {
            width: 100%;
            border-collapse: collapse;
        }
        .header-table td { vertical-align: middle; text-align: center; padding: 0; }
        .header-logo-left, .header-logo-right { width: 15%; }
        .header-logo-left img, .header-logo-right img { width: 0.92in; height: auto; }
        .header-title { font-weight: bold; font-size: 12pt; margin: 0; }
        .header-subtitle { font-size: 12pt; font-weight: normal; margin: 0; }

        .footer-table { width: 100%; border-collapse: collapse; }
        .footer-table td { vertical-align: middle; }
        .footer-contact { text-align: center; }

        /* ── Report content ── */
        h2.report-title {
            text-align: center;
            font-size: 14pt;
            font-weight: bold;
            margin: 0 0 2pt;
            text-transform: uppercase;
            letter-spacing: 0.5pt;
        }

        h3.report-subtitle {
            text-align: center;
            font-size: 11pt;
            font-weight: normal;
            margin: 0 0 14pt;
        }

        .meta-block {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14pt;
            font-size: 10.5pt;
        }
        .meta-block td { padding: 2pt 4pt 2pt 0; vertical-align: middle; }
        .meta-block td.label { width: 22%; font-weight: bold; white-space: nowrap; }
        .meta-block td.value { width: 28%; border-bottom: 1pt solid #000; }

        .divider {
            border: none;
            border-top: 1.5pt solid #000;
            margin: 10pt 0 14pt;
        }

        p.preamble {
            text-indent: 0.5in;
            text-align: justify;
            margin: 0 0 14pt;
            font-size: 11pt;
            line-height: 1.5;
        }

        /* ── Section headings ── */
        h4.section-heading {
            font-size: 11pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.3pt;
            margin: 18pt 0 6pt;
            border-bottom: 1pt solid #ccc;
            padding-bottom: 3pt;
        }

        p.section-note {
            font-size: 10pt;
            font-style: italic;
            color: #333;
            margin: 0 0 8pt;
        }

        /* ── Data tables ── */
        table.data {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 6pt;
            font-size: 10.5pt;
        }

        table.data thead tr {
            background: #d9d9d9;
        }

        table.data th {
            border: 1pt solid #000;
            padding: 4pt 8pt;
            text-align: left;
            font-weight: bold;
            font-size: 10.5pt;
        }

        table.data td {
            border: 1pt solid #000;
            padding: 4pt 8pt;
            vertical-align: top;
        }

        table.data td.label {
            font-weight: bold;
            width: 38%;
            background: #f2f2f2;
            border: 1pt solid #000;
        }

        /* ── Photo evidence ── */
        .photo-wrap {
            text-align: center;
            margin-top: 8pt;
        }
        .photo-wrap img {
            max-width: 100%;
            max-height: 3.5in;
            border: 1pt solid #000;
        }

        /* ── Certification block ── */
        .certification {
            margin-top: 30pt;
            border: 1pt solid #000;
            padding: 12pt 16pt;
            font-size: 10.5pt;
            line-height: 1.5;
        }

        .certification p { margin: 0 0 8pt; text-align: justify; }
        .certification p:last-child { margin-bottom: 0; }

        table.sig-block {
            width: 100%;
            border-collapse: collapse;
            margin-top: 36pt;
        }
        table.sig-block td { width: 50%; text-align: center; vertical-align: bottom; }
        .sig-space { height: 36pt; }
        .sig-line {
            border-top: 1pt solid #000;
            margin: 0 20pt;
            padding-top: 3pt;
            font-size: 11pt;
            font-weight: bold;
        }
        .sig-subline {
            font-size: 10pt;
            font-weight: normal;
            margin: 2pt 20pt 0;
        }
    </style>
</head>

<body>

@php
    $denrLogo = 'data:image/jpeg;base64,' . base64_encode(
        file_get_contents(public_path('images/denr-logo.jpg'))
    );
    $bagongPilipinasLogo = 'data:image/png;base64,' . base64_encode(
        file_get_contents(public_path('images/bagong-pilipinas-logo.png'))
    );

    $causeOfDecay = $details['cause_of_decay'] ?? '—';
    if ($causeOfDecay === 'Other' && !empty($details['cause_of_decay_other'])) {
        $causeOfDecay = $details['cause_of_decay_other'];
    }

    $inspectionDate = !empty($details['inspection_date'])
        ? \Carbon\Carbon::parse($details['inspection_date'])->format('F d, Y')
        : '—';

    $pieceList = collect($disposal->pieces ?? [])
        ->pluck('piece_number')
        ->sort()
        ->map(fn ($n) => "Piece {$n}/{$asset->quantity}")
        ->join(', ');
@endphp

{{-- Fixed page header --}}
<div class="page-header">
    <table class="header-table">
        <tr>
            <td class="header-logo-left"><img src="{{ $denrLogo }}" alt="DENR Logo"></td>
            <td style="width:70%;">
                <div style="font-size: 7.5pt; letter-spacing: 0.04em; color: #444; margin-bottom: 1pt;">Republic of the Philippines</div>
                <div class="header-title">Department of Environment and Natural Resources</div>
                <div style="font-size: 7.5pt; font-style: italic; color: #555; margin-bottom: 2pt;">Kagawaran ng Kapaligiran at Likas na Yaman</div>
                <div style="font-size: 8.5pt; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase; color: #333;">PENRO Catanduanes</div>
            </td>
            <td class="header-logo-right"><img src="{{ $bagongPilipinasLogo }}" alt="Bagong Pilipinas Logo"></td>
        </tr>
    </table>
</div>

{{-- Fixed page footer --}}
<div class="page-footer">
    <table class="footer-table">
        <tr>
            <td class="footer-contact">
                San Isidro Village, Virac, Catanduanes, Philippines<br>
                eMail: penrocatanduanes@denr.gov.ph |
                Tel. no. (052) 740 5735 |
                VOIP: 2841
            </td>
        </tr>
    </table>
</div>

{{-- ── Report title ── --}}
<h2 class="report-title">Forest Asset Decay Report</h2>
<h3 class="report-subtitle">
    Pursuant to DAO 97-32 — DENR-PENRO Catanduanes
</h3>
<hr class="divider">

{{-- ── Meta block ── --}}
<table class="meta-block">
    <tr>
        <td class="label">Date Generated:</td>
        <td class="value">{{ now()->format('F d, Y, h:i A') }}</td>
        <td class="label">Inspection Date:</td>
        <td class="value">{{ $inspectionDate }}</td>
    </tr>
    <tr>
        <td class="label">Issuing Office:</td>
        <td class="value">PENRO — Catanduanes</td>
        <td class="label">Disposal Reference:</td>
        <td class="value" style="font-weight:bold;">#{{ $disposal->id }}</td>
    </tr>
</table>

{{-- ── Preamble ── --}}
<p class="preamble">
    This Forest Asset Decay Report is prepared by the Provincial Environment and Natural
    Resources Office (PENRO) of Catanduanes in compliance with Department Administrative Order
    (DAO) No. 97-32 and other applicable forestry laws and regulations. It documents the physical
    deterioration and consequent write-off of a forest asset under the custody of this Office,
    following a formal inspection conducted by a duly authorized officer.
</p>
<p class="preamble">
    The asset described herein has been found to be in a state of decay and is no longer fit for
    disposition through donation, auction, or other standard modes of disposal. Its quantity has
    accordingly been deducted from the official ForesTrack inventory of DENR-PENRO Catanduanes,
    effective the inspection date indicated in this report. This document serves as the official
    record of that deduction and is issued for compliance, audit, and reference purposes.
</p>

{{-- ── Section I: Asset Information ── --}}
<h4 class="section-heading">I. Asset Information</h4>
<p class="section-note">
    Details of the forest asset subject to decay disposal as recorded in the ForesTrack inventory system.
</p>

<table class="data">
    <tr>
        <td class="label">Asset Code</td>
        <td>{{ $asset->asset_code }}</td>
    </tr>
    <tr>
        <td class="label">AAP No.</td>
        <td>{{ $asset->aap_number ?? '—' }}</td>
    </tr>
    <tr>
        <td class="label">Asset Type</td>
        <td>{{ ucfirst($asset->type->value) }}</td>
    </tr>
    <tr>
        <td class="label">Species</td>
        <td>{{ $asset->species ?? '—' }}</td>
    </tr>
    <tr>
        <td class="label">Description</td>
        <td>{{ $asset->description ?? '—' }}</td>
    </tr>
    <tr>
        <td class="label">Quantity Disposed</td>
        <td>{{ $disposal->quantity }} unit(s)</td>
    </tr>
    @if ($pieceList)
    <tr>
        <td class="label">Pieces Disposed</td>
        <td>{{ $pieceList }}</td>
    </tr>
    @endif
    @if ($asset->volume_bd_ft)
    <tr>
        <td class="label">Volume (bd ft)</td>
        <td>{{ number_format($disposal->volume_bd_ft, 2) }}</td>
    </tr>
    @endif
</table>

{{-- ── Section II: Decay Details ── --}}
<h4 class="section-heading">II. Decay Details</h4>
<p class="section-note">
    Findings from the physical inspection conducted on the asset prior to write-off.
</p>

<table class="data">
    <tr>
        <td class="label">Cause of Decay</td>
        <td>{{ $causeOfDecay }}</td>
    </tr>
    <tr>
        <td class="label">Inspection Date</td>
        <td>{{ $inspectionDate }}</td>
    </tr>
    <tr>
        <td class="label">Inspecting Officer</td>
        <td>{{ $details['inspecting_officer'] ?? '—' }}</td>
    </tr>
    <tr>
        <td class="label">Notes</td>
        <td>{{ $details['notes'] ?? '—' }}</td>
    </tr>
</table>

{{-- ── Section III: Processing Information ── --}}
<h4 class="section-heading">III. Processing Information</h4>
<p class="section-note">
    Administrative details of the disposal action recorded in the ForesTrack system.
</p>

<table class="data">
    <tr>
        <td class="label">Report Date</td>
        <td>{{ now()->format('F d, Y') }}</td>
    </tr>
    <tr>
        <td class="label">Processed By</td>
        <td>{{ $disposal->processedBy?->name ?? '—' }}</td>
    </tr>
    <tr>
        <td class="label">Disposal Reference No.</td>
        <td>#{{ $disposal->id }}</td>
    </tr>
</table>

{{-- ── Section IV: Photo Evidence ── --}}
@if ($photoDataUri)
<h4 class="section-heading">IV. Photo Evidence</h4>
<p class="section-note">
    Photograph taken at the time of inspection to document the condition of the asset.
</p>
<div class="photo-wrap">
    <img src="{{ $photoDataUri }}" alt="Decay photo evidence">
</div>
@endif

{{-- ── Certification ── --}}
<div class="certification">
    <p>
        I hereby certify that the asset described in this report has been physically inspected
        and confirmed to be in a state of decay, rendering it unfit for further use or standard
        modes of disposal. The quantity indicated herein has been officially written off and
        deducted from the DENR-PENRO Catanduanes forest asset inventory in accordance with
        the provisions of DAO 97-32, PD 705 (Revised Forestry Code of the Philippines), and
        other applicable DENR issuances.
    </p>
    <p>
        This report is issued for compliance, audit, and regulatory reference purposes only.
        Unauthorized reproduction or alteration of this document is strictly prohibited.
    </p>
</div>

{{-- ── Signature block ── --}}
<table class="sig-block">
    <tr>
        <td>
            <div class="sig-space"></div>
            <div class="sig-line">{{ $details['inspecting_officer'] ?? 'Inspecting Officer' }}</div>
            <div class="sig-subline">Inspecting Officer</div>
        </td>
        <td>
            <div class="sig-space"></div>
            <div class="sig-line">PENRO — Catanduanes</div>
            <div class="sig-subline">Provincial Environment and Natural Resources Officer</div>
        </td>
    </tr>
</table>

</body>
</html>