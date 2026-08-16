<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Deed of Donation</title>
    <style>
        /* Top/bottom margins are enlarged to reserve room for the fixed
           header and footer below — DomPDF only repeats position:fixed
           elements on every page, so the letterhead and footer are pulled
           out of normal flow and placed inside these reserved margins
           (see .page-header / .footer, which use negative offsets to sit
           inside the margin area instead of the content area). */
        @page {
            size: legal;
            margin: 1.6in 0.7in 0.95in 0.7in;
        }

        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 11.5pt;
            color: #000;
            line-height: 1.35;
        }

        /* ---------- Letterhead (repeats on every page) ---------- */
        .page-header {
            position: fixed;
            margin-top: 10px;
            left: 0;
            right: 0;
            height: 1.6in;
        }

        .header-table {
            width: 100%;
            border-collapse: collapse;
        }

        .header-table td {
            vertical-align: middle;
            text-align: center;
            padding: 0;
        }

        .header-logo-left,
        .header-logo-right {
            width: 15%;
        }

        .header-logo-left img,
        .header-logo-right img {
            width: 0.85in;
            height: auto;
        }

        .header-title {
            font-weight: bold;
            font-size: 11.5pt;
            margin: 0;
        }

        .header-subtitle {
            font-size: 11pt;
            font-weight: normal;
            margin: 0;
        }

        hr.header-rule {
            border: none;
            border-top: 1.5pt solid #000;
            margin: 6pt 0 10pt;
        }

        h1.deed-title {
            text-align: center;
            font-size: 14pt;
            font-weight: bold;
            letter-spacing: 1pt;
            margin: 4pt 0 16pt;
        }

        .section-heading {
            text-align: center;
            font-weight: bold;
            text-decoration: underline;
            letter-spacing: 1pt;
            margin: 14pt 0 10pt;
        }

        p.body-text {
            text-align: justify;
            text-indent: 0.4in;
            margin: 0 0 10pt;
        }

        p.know-all-men {
            font-weight: bold;
            margin: 0 0 10pt;
        }

        /* ---------- Donated asset table ---------- */
        p.asset-table-caption {
            font-weight: bold;
            text-align: center;
            margin: 4pt 0 6pt;
        }

        table.asset-table {
            width: 100%;
            border-collapse: collapse;
            margin: 0 0 14pt;
        }

        table.asset-table th,
        table.asset-table td {
            border: 1pt solid #000;
            padding: 5pt 8pt;
            text-align: center;
        }

        table.asset-table thead th {
            background-color: #e5e5e5;
            font-weight: bold;
        }

        /* ---------- Signature blocks ----------
           Each visual "row" (office heading / BY: / signature line) is its
           own <tr>, not stacked inside one <td>. HTML tables automatically
           equalize row height across both cells in the same row, so the
           "BY:" and signature lines line up regardless of how many lines
           the donor/donee heading wraps to. */
        table.signatures {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20pt;
        }

        table.signatures td {
            width: 50%;
            vertical-align: bottom;
            padding: 0 10pt;
        }

        .signatory-heading {
            font-weight: bold;
            line-height: 1.3;
            margin: 0;
        }

        .signatory-by {
            font-weight: bold;
            margin: 10pt 0 30pt;
        }

        .sig-line {
            border-top: 1pt solid #000;
            padding-top: 2pt;
            margin: 0 6pt;
            text-align: center;
        }

        .sig-name {
            font-weight: bold;
        }

        .sig-title {
            font-size: 10.5pt;
        }

        .witness-heading {
            text-align: center;
            font-weight: bold;
            margin: 26pt 0 6pt;
        }

        table.witnesses {
            width: 100%;
            border-collapse: collapse;
        }

        table.witnesses td {
            width: 50%;
            text-align: center;
            padding-top: 26pt;
        }

        .witness-line {
            border-top: 1pt solid #000;
            margin: 0 30pt;
            padding-top: 2pt;
        }

        .execution-date {
            margin: 14pt 0 0;
        }

        /* ---------- Footer (repeats on every page) ---------- */
        .footer {
            position: fixed;
            bottom: -0.95in;
            left: 0;
            right: 0;
            height: 0.95in;
            margin-top: 0;
            text-align: center;
            font-size: 9pt;
            font-style: italic;
            border-top: 0.5pt solid #999;
            padding-top: 6pt;
        }
    </style>
</head>
<body>

@php
    $denrLogo = 'data:image/jpeg;base64,' . base64_encode(
        file_exists(public_path('images/denr-logo.jpg')) ? file_get_contents(public_path('images/denr-logo.jpg')) : ''
    );

    $bagongPilipinasLogo = 'data:image/png;base64,' . base64_encode(
        file_exists(public_path('images/bagong-pilipinas-logo.png')) ? file_get_contents(public_path('images/bagong-pilipinas-logo.png')) : ''
    );

    // OIC / donor representative — editable per-document via the disposal
    // form; falls back to config/office.php only when left blank.
    $donorName = $donation->donorRepresentativeName();
    $donorTitle = $donation->donorRepresentativeTitle();

    $doneeName = $donation->requester_name;
    $doneePosition = $donation->donee_position;

    // "Donee Office" — the institution the item is being donated to.
    // Editable via the form's "Donee Office / Institution Name" field
    // (stored on agency_name). Falls back to a literal placeholder only
    // for older records that predate this field.
    $doneeOfficeName = $donation->agency_name ?: 'DONEE OFFICE';
    $doneeOfficeAddress = $donation->fullAddress();

    $witness1Name = $donation->witness1Name();
    $witness1Title = $donation->witness1Title();
    $witness2Name = $donation->witness2Name();
    $witness2Title = $donation->witness2Title();

    $volumeBdFt = $disposal->volume_bd_ft ?? $asset->volume_bd_ft;
    $executionDate = $disposal->processed_at ?? now();

    // Dimensions rendered as L x W x H, omitting the row's own units since
    // the Asset model doesn't carry a dimension-unit field. Falls back to
    // an em-dash when none of the three are recorded.
    $hasDimensions = $asset->length || $asset->width || $asset->height;
    $dimensionsText = $hasDimensions
        ? number_format((float) $asset->length, 2) . ' x ' . number_format((float) $asset->width, 2) . ' x ' . number_format((float) $asset->height, 2)
        : '—';
@endphp

<div class="page-header">
    <table class="header-table">
        <tr>
            <td class="header-logo-left">
                <img src="{{ $denrLogo }}">
            </td>
            <td style="width:70%;">
                <div class="header-title">DEPARTMENT OF ENVIRONMENT AND NATURAL RESOURCES</div>
                <div class="header-subtitle">KAGAWARAN NG KAPALIGIRAN AT LIKAS NA YAMAN</div>
            </td>
            <td class="header-logo-right">
                <img src="{{ $bagongPilipinasLogo }}">
            </td>
        </tr>
    </table>
    <hr class="header-rule">
</div>

<div class="footer">
    San Isidro Village, Virac, Catanduanes, Philippines<br>
    eMail: penrocatanduanes@denr.gov.ph | Tel. no. (052) 740 5735 | VOIP: 2841
</div>

<h1 class="deed-title">DEED OF DONATION</h1>

<p class="know-all-men">KNOW ALL MEN BY THESE PRESENTS:</p>

<p class="body-text">
    This <strong>DEED OF DONATION</strong>, made and executed by the Department of Environment and
    Natural Resources &ndash; PENRO, Catanduanes, represented by {{ $donorTitle }}
    <strong>{{ mb_strtoupper($donorName) }}</strong> of PENRO&ndash;Catanduanes, hereinafter called the
    <strong>DONOR</strong>, in favor of {{ $doneeOfficeName !== 'DONEE OFFICE' ? $doneeOfficeName : 'the donee institution' }}, Catanduanes
    represented by {{ $doneePosition ? $doneePosition . ' ' : '' }}<strong>{{ mb_strtoupper($doneeName) }}</strong>
    @if($doneePosition)
        , {{ $doneePosition }},
    @endif
    hereinafter called the <strong>DONEE</strong>.
</p>

<h2 class="section-heading">WITNESSETH</h2>

<p class="body-text">
    That the DONEE has the need of pieces of good lumber materials{{ $donation->purpose_statement ? ' ' . $donation->purpose_statement : ' for its operational needs' }},
    but does not have funds to purchase the forest products for the purpose.
</p>

<p class="body-text">
    That the DONOR has available lumber with a total volume of
    {{ $volumeBdFt ? number_format((float) $volumeBdFt, 2) : '_____' }} board feet
    @if($donation->confiscation_order_reference)
        with approved Confiscation Order {{ $donation->confiscation_order_reference }} from the Regional Executive Director
    @else
        with approved Confiscation Order from the Regional Executive Director
    @endif
    and has been entered into the Book of Account under the custody of DENR&ndash;PENRO, Virac, Catanduanes.
    The DONOR hereby donates the said forest products to {{ $doneeOfficeName !== 'DONEE OFFICE' ? 'be used by ' . $doneeOfficeName : 'be used by the DONEE' }}.
    The DONEE hereby accepts the donation and expresses its appreciation for the liberality of the DONOR.
</p>

<table class="asset-table">
    <thead>
        <tr>
            <th>AAP No.</th>
            <th>Dimensions</th>
            <th>Volume (bd. ft)</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>{{ $asset->aap_number ?: '—' }}</td>
            <td>{{ $dimensionsText }}</td>
            <td>{{ $volumeBdFt ? number_format((float) $volumeBdFt, 2) : '—' }}</td>
        </tr>
    </tbody>
</table>

<p class="body-text">
    That the DONEE shall submit a detailed report of the use of the donated lumber on the accomplished
    project pursuant to post requirements stated in Memorandum Order No. 162 within fifteen (15) days after
    such completion. The report shall serve as basis of monitoring the disposition of the donated confiscated
    forest products.
</p>

<p class="body-text">
    This donation is hereby executed in accordance with Memorandum Order No. 162, as amended by
    Memorandum Order No. 284 and DENR Administrative Order No. 2022-10.
</p>

<p class="body-text execution-date">
    <strong>IN WITNESS WHEREOF</strong>, the DONOR and the DONEE have hereunto set their hands this
    ____ day of <strong>{{ $executionDate->format('F d, Y') }}</strong> in Virac, Catanduanes, Philippines.
</p>

<table class="signatures">
    <tr>
        <td>
            <p class="signatory-heading">
                DEPARTMENT OF ENVIRONMENT<br>
                AND NATURAL RESOURCES<br>
                PENRO&ndash;CATANDUANES
            </p>
        </td>
        <td>
            <p class="signatory-heading">
                {{ mb_strtoupper($doneeOfficeName) }}
                @if($doneeOfficeAddress)
                    <br>{{ mb_strtoupper($doneeOfficeAddress) }}
                @endif
            </p>
        </td>
    </tr>
    <tr>
        <td><p class="signatory-by">BY:</p></td>
        <td><p class="signatory-by">BY:</p></td>
    </tr>
    <tr>
        <td>
            <p class="sig-line">
                <span class="sig-name">{{ mb_strtoupper($donorName) }}</span><br>
                <span class="sig-title">{{ $donorTitle }}<br>(Donor)</span>
            </p>
        </td>
        <td>
            <p class="sig-line">
                <span class="sig-name">{{ mb_strtoupper($doneeName) }}</span><br>
                <span class="sig-title">{{ $doneePosition ?: 'Representative' }}<br>(Donee)</span>
            </p>
        </td>
    </tr>
</table>

<p class="witness-heading">Signed in the presence of:</p>

<table class="witnesses">
    <tr>
        <td>
            <div class="sig-line witness-line">
                <span class="sig-name">{{ mb_strtoupper($witness1Name) }}</span><br>
                <span class="sig-title">{{ $witness1Title }}</span>
            </div>
        </td>
        <td>
            <div class="sig-line witness-line">
                <span class="sig-name">{{ mb_strtoupper($witness2Name) }}</span><br>
                <span class="sig-title">{{ $witness2Title }}</span>
            </div>
        </td>
    </tr>
</table>

</body>
</html>