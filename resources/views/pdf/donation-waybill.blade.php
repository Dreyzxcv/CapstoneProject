<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Donation Waybill</title>
    <style>
        @page {
            margin: 0.15in;
            size: 4in 6in;
        }

        body {
            font-family: 'Helvetica', Arial, sans-serif;
            font-size: 8.5pt;
            color: #000;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        .label-page {
            page-break-after: always;
        }

        .label-page:last-child {
            page-break-after: auto;
        }

        .header-row {
            border-bottom: 2pt solid #000;
            padding-bottom: 4pt;
            margin-bottom: 6pt;
        }

        .logo-cell {
            width: 0.7in;
            vertical-align: middle;
        }

        .logo-placeholder {
            display: block;
            width: 0.55in;
            height: 0.55in;
            border: 1pt dashed #999;
            text-align: center;
            line-height: 0.55in;
            font-size: 6pt;
            color: #999;
        }

        .org-cell {
            vertical-align: middle;
            padding-left: 6pt;
        }

        .org-title {
            font-size: 9pt;
            font-weight: bold;
            margin: 0;
        }

        .org-subtitle {
            font-size: 6.5pt;
            margin: 1pt 0 0;
            color: #333;
        }

        .piece-badge {
            border: 1.5pt solid #000;
            text-align: center;
            padding: 5pt 0;
            font-size: 16pt;
            font-weight: bold;
            letter-spacing: 0.5pt;
            margin: 6pt 0;
        }

        .service-line {
            text-align: center;
            font-weight: bold;
            font-size: 10pt;
            text-transform: uppercase;
            border-top: 1pt solid #000;
            border-bottom: 1pt solid #000;
            padding: 3pt 0;
            margin: 0 0 6pt;
        }

        .addr-box {
            border: 1pt solid #000;
            padding: 5pt;
            margin-bottom: 6pt;
        }

        .addr-label {
            font-size: 6.5pt;
            font-weight: bold;
            text-transform: uppercase;
            color: #444;
            margin: 0 0 2pt;
        }

        .addr-value {
            font-size: 8.5pt;
            margin: 0;
            line-height: 1.35;
        }

        .item-table th,
        .item-table td {
            border: 1pt solid #000;
            padding: 3pt 4pt;
            font-size: 7.5pt;
            text-align: left;
        }

        .item-table th {
            width: 38%;
            background: #f2f2f2;
        }

        .item-table {
            margin-bottom: 6pt;
        }

        .qr-footer {
            border-top: 1pt solid #000;
            padding-top: 6pt;
            margin-top: 4pt;
        }

        .qr-cell {
            width: 0.95in;
            text-align: center;
            vertical-align: top;
        }

        .qr-cell img {
            width: 0.85in;
            height: 0.85in;
        }

        .doc-cell {
            vertical-align: top;
            padding-left: 6pt;
            font-size: 7pt;
        }

        .doc-cell p {
            margin: 1pt 0;
        }

        .footer-note {
            text-align: center;
            font-size: 6pt;
            color: #555;
            margin-top: 5pt;
            font-style: italic;
        }
    </style>
</head>
<body>

@php
    $piecesQty = max(1, (int) ($totalPieces ?? 1));
    $hasDoneeAddress = $donation->street || $donation->barangay || $donation->municipality;
@endphp

@for ($piece = 1; $piece <= $piecesQty; $piece++)
<div class="label-page">

    <table class="header-row">
        <tr>
            <td class="logo-cell">
                <span class="logo-placeholder">DENR<br>LOGO</span>
            </td>
            <td class="org-cell">
                <p class="org-title">DENR &middot; PENRO CATANDUANES</p>
                <p class="org-subtitle">Donation Release &middot; LogTrack Insight</p>
            </td>
        </tr>
    </table>

    <div class="piece-badge">
        PIECE {{ $piece }} / {{ $piecesQty }}
    </div>

    <div class="service-line">Donation Waybill</div>

    <div class="addr-box">
        <p class="addr-label">From</p>
        <p class="addr-value">
            DENR-PENRO Catanduanes<br>
            San Isidro Village, Virac, Catanduanes
        </p>
    </div>

    <div class="addr-box">
        <p class="addr-label">To (Donee)</p>
        <p class="addr-value">
            {{ $maskedRequesterName }}<br>
            @if($donation->agency_name)
                {{ $donation->agency_name }}<br>
            @endif
            @if($hasDoneeAddress)
                @if($donation->street)
                    {{ $donation->street }}<br>
                @endif
                {{ collect([$donation->barangay, $donation->municipality?->value, 'Catanduanes'])->filter()->implode(', ') }}
            @else
                <em>Address not on file</em>
            @endif
        </p>
    </div>

    <table class="item-table">
        <tr>
            <th>Asset Code</th>
            <td>{{ $asset->asset_code }}</td>
        </tr>
        <tr>
            <th>Item</th>
            <td>
                {{ $asset->type->label() }}
                @if($asset->species) &mdash; {{ $asset->species }} @endif
            </td>
        </tr>
        <tr>
            <th>Total Quantity</th>
            <td>{{ $piecesQty }}</td>
        </tr>
    </table>

    <table class="qr-footer">
        <tr>
            <td class="qr-cell">
                <img src="{{ $qrPngDataUri }}" alt="QR code">
            </td>
            <td class="doc-cell">
                <p><strong>Donation No.:</strong> D-{{ str_pad((string) $disposal->id, 5, '0', STR_PAD_LEFT) }}</p>
                <p><strong>Date Issued:</strong> {{ now()->format('M d, Y') }}</p>
                <p><strong>Processed By:</strong> {{ $disposal->processedBy?->name ?? '—' }}</p>
            </td>
        </tr>
    </table>

    <p class="footer-note">
        Scan the QR code to view the live asset record. System-generated by LogTrack Insight.
    </p>

</div>
@endfor

</body>
</html>