<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Compliance Report — DENR-PENRO Catanduanes</title>

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

        table.data th.center,
        table.data td.center { text-align: center; }
        table.data th.right,
        table.data td.right  { text-align: right; }

        table.data td {
            border: 1pt solid #000;
            padding: 4pt 8pt;
            vertical-align: top;
        }

        table.data tr.subtotal td {
            font-weight: bold;
            background: #f2f2f2;
            border-top: 1.5pt solid #000;
        }

        table.data tr.highlight-top td {
            font-weight: bold;
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

        .page-break { page-break-before: always; }
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

    $totalAssets     = $byMunicipality->sum('count');
    $totalByStatus   = collect($byStatus)->sum('count');

    // Determine the dominant asset type for the preamble
    $dominantType = collect($byType)->sortByDesc('count')->first();

    // Split status into active vs. disposed for the narrative
    $terminalKeys  = ['donated', 'decayed', 'fabricated', 'released', 'forfeited', 'damaged'];
    $activeCount   = collect($byStatus)
        ->whereNotIn('status', array_map('strtolower', $terminalKeys))
        ->sum('count');
    $disposedCount = collect($byStatus)
        ->filter(fn ($r) => str_contains(strtolower($r['status']), 'donat')
            || str_contains(strtolower($r['status']), 'releas')
            || str_contains(strtolower($r['status']), 'decayed')
            || str_contains(strtolower($r['status']), 'fabricat')
            || str_contains(strtolower($r['status']), 'forfeit')
            || str_contains(strtolower($r['status']), 'damage')
        )
        ->sum('count');
    $topMunicipality = $byMunicipality->sortByDesc('count')->first();
@endphp

{{-- Fixed page header --}}
<div class="page-header">
    <table class="header-table">
        <tr>
            <td class="header-logo-left"><img src="{{ $denrLogo }}"></td>
            <td style="width:70%;">
                <div class="header-title">DEPARTMENT OF ENVIRONMENT AND NATURAL RESOURCES</div>
                <div class="header-subtitle">KAGAWARAN NG KAPALIGIRAN AT LIKAS NA YAMAN</div>
            </td>
            <td class="header-logo-right"><img src="{{ $bagongPilipinasLogo }}"></td>
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
<h2 class="report-title">Inventory &amp; Compliance Report</h2>
<h3 class="report-subtitle">
    Pursuant to DAO 97-32 — DENR-PENRO Catanduanes
</h3>
<hr class="divider">

{{-- ── Meta block ── --}}
<table class="meta-block">
    <tr>
        <td class="label">Date Generated:</td>
        <td class="value">{{ $generatedAt->format('F d, Y, h:i A') }}</td>
        <td class="label">Reporting Period:</td>
        <td class="value">As of {{ $generatedAt->format('F d, Y') }}</td>
    </tr>
    <tr>
        <td class="label">Issuing Office:</td>
        <td class="value">PENRO — Catanduanes</td>
        <td class="label">Total Assets on Record:</td>
        <td class="value" style="font-weight:bold;">{{ number_format($totalAssets) }}</td>
    </tr>
</table>

{{-- ── Preamble ── --}}
<p class="preamble">
    This Inventory and Compliance Report is prepared by the Provincial Environment and Natural
    Resources Office (PENRO) of Catanduanes in compliance with Department Administrative Order
    (DAO) No. 97-32 and other applicable forestry laws and regulations. It presents a consolidated
    account of all forest products, equipment, and conveyances apprehended or turned over to this
    office, reflecting their current custody status, disposition outcomes, and geographic
    distribution across the province.
</p>
<p class="preamble">
    As of the date of this report, a total of <strong>{{ number_format($totalAssets) }} asset{{ $totalAssets === 1 ? '' : 's' }}</strong>
    are recorded in the ForesTrack inventory system.
    @if($dominantType)
        The largest category is <strong>{{ $dominantType['type'] }}</strong>,
        accounting for {{ number_format($dominantType['count']) }} asset{{ $dominantType['count'] === 1 ? '' : 's' }}.
    @endif
    @if($topMunicipality)
        The municipality with the highest number of confiscations is
        <strong>{{ $topMunicipality->municipality_of_origin }}</strong>
        with {{ number_format($topMunicipality->count) }} recorded case{{ $topMunicipality->count === 1 ? '' : 's' }}.
    @endif
</p>

{{-- ── Section 1: By Status ── --}}
<h4 class="section-heading">I. Summary by Custody Status</h4>
<p class="section-note">
    The table below reflects the current workflow stage of all recorded assets. Assets remain
    under the custody of this office until formally disposed of in accordance with DENR regulations.
</p>

<table class="data">
    <thead>
        <tr>
            <th style="width:60%;">Custody Status</th>
            <th class="center" style="width:20%;">No. of Assets</th>
            <th class="right" style="width:20%;">Percentage</th>
        </tr>
    </thead>
    <tbody>
        @foreach($byStatus as $row)
        <tr>
            <td>{{ $row['status'] }}</td>
            <td class="center">{{ number_format($row['count']) }}</td>
            <td class="right">
                {{ $totalByStatus > 0 ? number_format(($row['count'] / $totalByStatus) * 100, 1) : '0.0' }}%
            </td>
        </tr>
        @endforeach
        <tr class="subtotal">
            <td>TOTAL</td>
            <td class="center">{{ number_format($totalByStatus) }}</td>
            <td class="right">100.0%</td>
        </tr>
    </tbody>
</table>

{{-- ── Section 2: By Asset Type ── --}}
<h4 class="section-heading">II. Summary by Asset Type</h4>
<p class="section-note">
    Assets are classified according to their nature as forest products (logs/lumber),
    equipment/tools, or conveyances/vehicles apprehended in connection with forestry violations.
</p>

<table class="data">
    <thead>
        <tr>
            <th style="width:60%;">Asset Type</th>
            <th class="center" style="width:20%;">No. of Assets</th>
            <th class="right" style="width:20%;">Percentage</th>
        </tr>
    </thead>
    <tbody>
        @php $totalType = collect($byType)->sum('count'); @endphp
        @foreach($byType as $row)
        <tr>
            <td>{{ $row['type'] }}</td>
            <td class="center">{{ number_format($row['count']) }}</td>
            <td class="right">
                {{ $totalType > 0 ? number_format(($row['count'] / $totalType) * 100, 1) : '0.0' }}%
            </td>
        </tr>
        @endforeach
        <tr class="subtotal">
            <td>TOTAL</td>
            <td class="center">{{ number_format($totalType) }}</td>
            <td class="right">100.0%</td>
        </tr>
    </tbody>
</table>

{{-- ── Section 3: By Municipality ── --}}
<h4 class="section-heading">III. Distribution by Municipality of Origin</h4>
<p class="section-note">
    This section identifies the municipalities from which confiscated or turned-over assets
    originate. Rankings are arranged in descending order by volume.
</p>

<table class="data">
    <thead>
        <tr>
            <th class="center" style="width:10%;">Rank</th>
            <th style="width:55%;">Municipality</th>
            <th class="center" style="width:18%;">No. of Assets</th>
            <th class="right" style="width:17%;">Percentage</th>
        </tr>
    </thead>
    <tbody>
        @php
            $totalMuni  = $byMunicipality->sum('count');
            $sortedMuni = $byMunicipality->sortByDesc('count')->values();
        @endphp
        @foreach($sortedMuni as $i => $row)
        <tr @if($i === 0) class="highlight-top" @endif>
            <td class="center">{{ $i + 1 }}</td>
            <td>{{ $row->municipality_of_origin }}</td>
            <td class="center">{{ number_format($row->count) }}</td>
            <td class="right">
                {{ $totalMuni > 0 ? number_format(($row->count / $totalMuni) * 100, 1) : '0.0' }}%
            </td>
        </tr>
        @endforeach
        <tr class="subtotal">
            <td class="center">—</td>
            <td>TOTAL</td>
            <td class="center">{{ number_format($totalMuni) }}</td>
            <td class="right">100.0%</td>
        </tr>
    </tbody>
</table>

{{-- ── Certification ── --}}
<div class="certification">
    <p>
        I hereby certify that the data presented in this report are true and accurate
        representations of the inventory records maintained by this Office as of the date
        indicated herein, and that all apprehended and turned-over assets are accounted for in
        accordance with the provisions of DAO 97-32, PD 705 (Revised Forestry Code of the
        Philippines), and other applicable DENR issuances.
    </p>
    <p>
        This report is issued for compliance, reference, and regulatory purposes only.
        Unauthorized reproduction or alteration of this document is strictly prohibited.
    </p>
</div>

{{-- ── Signature block ── --}}
<table class="sig-block">
    <tr>
        <td>
            <div class="sig-space"></div>
            <div class="sig-line">PENRO — Catanduanes</div>
            <div class="sig-subline">Provincial Environment and Natural Resources Officer</div>
        </td>
        <td>
            <div class="sig-space"></div>
            <div class="sig-line">Prepared by</div>
            <div class="sig-subline">Records / Inventory Officer</div>
        </td>
    </tr>
</table>

</body>
</html>