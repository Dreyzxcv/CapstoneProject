<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $asset->mode?->value === 'turned_over' ? 'Custody Receipt — Turned Over' : 'Custody Receipt' }}</title>

    <style>
        @page {
            margin-top: 1.3in;
            margin-bottom: 1.0in;
            margin-left: 0.75in;
            margin-right: 0.75in;
            size: 8.5in 14in;
        }

        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 10.5pt;
            color: #111;
            line-height: 1.4;
        }

        /* ── Page header (fixed) ── */
        .page-header {
            position: fixed;
            top: -1.1in;
            padding: 0;
            margin: 0;
        }

        .header-inner {
            display: table;
            width: 100%;
            border-collapse: collapse;
            padding-bottom: 6pt;
            border-bottom: 1.5pt solid #111;
            padding-left: 0.75in;
            padding-right: 0.75in;
        }

        .header-inner td { vertical-align: middle; }

        .header-logo-left,
        .header-logo-right { width: 15%; text-align: center; }
        .header-logo-left img,
        .header-logo-right img { width: 0.85in; height: auto; }

        .header-center { text-align: center; padding: 0 6pt; }
        .header-republic { font-size: 7.5pt; letter-spacing: 0.04em; margin-bottom: 1pt; color: #444; }
        .header-agency   { font-size: 11.5pt; font-weight: bold; line-height: 1.2; margin-bottom: 1pt; }
        .header-filipino { font-size: 7.5pt; font-style: italic; color: #555; margin-bottom: 2pt; }
        .header-office   { font-size: 8.5pt; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase; color: #333; }

        /* ── Document title ── */
        .doc-title-block {
            text-align: center;
            margin: 0 0 10pt;
            padding-bottom: 8pt;
            border-bottom: 0.5pt solid #ccc;
        }
        .doc-title {
            font-size: 13pt;
            font-weight: bold;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            margin: 0 0 2pt;
        }
        .doc-subtitle {
            font-size: 8.5pt;
            color: #666;
            font-style: italic;
            letter-spacing: 0.03em;
            margin: 0;
        }

        /* ── Intro paragraph ── */
        p.intro {
            text-indent: 0.45in;
            text-align: justify;
            line-height: 1.5;
            margin: 0 0 10pt;
            font-size: 10pt;
        }

        /* ── Items table ── */
        table.items {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10pt;
            table-layout: fixed;
            font-size: 10pt;
            border: 1pt solid #999;
        }

        table.items thead tr {
            background: #e5e7eb;
            color: #111;
        }

        table.items th {
            border: 1pt solid #999;
            padding: 5pt 7pt;
            font-weight: bold;
            text-align: center;
            font-size: 9.5pt;
            letter-spacing: 0.04em;
            text-transform: uppercase;
        }

        table.items th.col-qty     { width: 13%; }
        table.items th.col-item    { width: 24%; }
        table.items th.col-details { width: 63%; }

        table.items td {
            border: 1pt solid #999;
            padding: 5pt 7pt;
            vertical-align: top;
            font-size: 10pt;
        }

        table.items td.empty-cell {
            height: 2.5in;
            text-align: center;
            font-style: italic;
            border: 0.5pt solid #ddd;
        }

        table.items td.qty-cell {
            text-align: center;
        }
        table.items td small {
            font-size: 8.5pt;
            font-style: italic;
        }

        /* ── Custodian note ── */
        p.custodian-note {
            text-indent: 0.45in;
            text-align: justify;
            line-height: 1.5;
            margin: 0 0 12pt;
            font-size: 10pt;
        }

        /* ── Divider ── */
        .section-divider {
            border: none;
            border-top: 0.5pt solid #ccc;
            margin: 10pt 0;
        }

        /* ── Meta lines ── */
        .meta-grid {
            display: table;
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8pt;
        }
        .meta-row { display: table-row; }
        .meta-label {
            display: table-cell;
            width: 1.8in;
            font-weight: bold;
            font-size: 9.5pt;
            padding: 3pt 8pt 3pt 0;
            white-space: nowrap;
            vertical-align: bottom;
            color: #333;
            letter-spacing: 0.01em;
        }
        .meta-value {
            display: table-cell;
            border-bottom: 0.5pt solid #888;
            padding: 3pt 4pt;
            vertical-align: bottom;
            font-size: 10pt;
        }

        /* ── Signature block ── */
        table.signatures {
            width: 100%;
            border-collapse: collapse;
            margin-top: 32pt;
        }
        table.signatures td {
            width: 50%;
            text-align: center;
            vertical-align: bottom;
            padding: 0 16pt;
        }
        .sig-name-box {
            height: 30pt;
            border-bottom: 0.75pt solid #111;
            margin: 0 12pt;
        }
        .sig-label {
            font-size: 9pt;
            padding-top: 3pt;
            font-weight: bold;
            letter-spacing: 0.02em;
            text-transform: uppercase;
        }
        .sig-sublabel {
            height: 20pt;
            border-bottom: 0.5pt solid #888;
            margin: 10pt 12pt 0;
        }
        .sig-sublabel-text {
            font-size: 8.5pt;
            color: #666;
            padding-top: 2pt;
            font-style: italic;
        }

        /* ── Witnesses ── */
        .witnesses-section { margin-top: 20pt; }
        .witnesses-title {
            font-weight: bold;
            font-size: 9pt;
            letter-spacing: 0.06em;
            margin-bottom: 6pt;
            text-transform: uppercase;
            color: #333;
        }
        table.witnesses { width: 100%; border-collapse: collapse; }
        table.witnesses td { width: 50%; padding: 0 16pt; padding-top: 26pt; }
        .witness-line {
            border-top: 0.5pt solid #888;
            margin: 0 12pt;
        }
        .witness-label {
            font-size: 8.5pt;
            text-align: center;
            color: #666;
            padding-top: 2pt;
            font-style: italic;
        }

        /* ── Page footer (fixed) ── */
        .page-footer {
            position: fixed;
            bottom: -0.85in;
            left: 0;
            right: 0;
            padding: 0 0.75in;
            border-top: 0.75pt solid #999;
            padding-top: 4pt;
        }
        .footer-inner {
            display: table;
            width: 100%;
            border-collapse: collapse;
        }
        .footer-inner td { vertical-align: middle; }
        .footer-contact {
            font-size: 7.5pt;
            color: #666;
            line-height: 1.5;
        }
        .footer-qr { text-align: right; width: 70pt; }
        .footer-qr img { width: 58pt; height: 58pt; display: block; margin-left: auto; }
        .footer-qr p { margin: 1pt 0 0; font-size: 6.5pt; text-align: center; color: #777; }
    </style>
</head>

<body>

@php
    $isTurnedOver = $asset->mode?->value === 'turned_over';
    $items = $items ?? collect([$asset]);

    $groupedItems = $items
        ->groupBy(function ($item) {
            if ($item instanceof \App\Models\AssetPiece) {
                $parentAsset = $item->relationLoaded('asset') ? $item->asset : null;
                $type    = $parentAsset?->type?->value ?? 'unknown';
                $subtype = $item->species ?? $item->equipment_type ?? $item->vehicle_type ?? 'unknown';
            } else {
                $type    = $item->type?->value ?? 'unknown';
                $subtype = $item->species ?? $item->equipment_type ?? $item->vehicle_type ?? 'unknown';
            }
            return $type . '|' . trim(strtolower($subtype));
        })
        ->map(function ($group) {
            $first = $group->first();

            if ($first instanceof \App\Models\AssetPiece) {
                $parentAsset = $first->relationLoaded('asset') ? $first->asset : null;
                return (object) [
                    'type_label'     => $parentAsset?->type?->label() ?? '—',
                    'asset_type'     => $parentAsset?->type?->value ?? 'unknown',
                    'species'        => $first->species,
                    'equipment_type' => $first->equipment_type,
                    'vehicle_type'   => $first->vehicle_type,
                    'quantity'       => $group->count(),
                    'volume_bd_ft'   => $group->sum(fn ($i) => (float) ($i->volume_bd_ft ?? 0)) ?: null,
                    'volume_cu_m'    => $group->sum(fn ($i) => (float) ($i->volume_cu_m  ?? 0)) ?: null,
                    'description'    => $first->description,
                    'plate_number'   => $first->plate_number,
                    'serial_number'  => $first->serial_number,
                ];
            }

            return (object) [
                'type_label'     => $first->type?->label() ?? '—',
                'asset_type'     => $first->type?->value ?? 'unknown',
                'species'        => $first->species,
                'equipment_type' => $first->equipment_type ?? null,
                'vehicle_type'   => $first->vehicle_type ?? null,
                'quantity'       => $first->quantity ?? 1,
                'volume_bd_ft'   => (float) ($first->volume_bd_ft ?? 0) ?: null,
                'volume_cu_m'    => (float) ($first->volume_cu_m  ?? 0) ?: null,
                'description'    => $first->description,
                'plate_number'   => $first->plate_number ?? null,
                'serial_number'  => null,
            ];
        })
        ->values();

    $denrLogo = 'data:image/jpeg;base64,' . base64_encode(
        file_get_contents(public_path('images/denr-logo.jpg'))
    );
    $bagongPilipinasLogo = 'data:image/png;base64,' . base64_encode(
        file_get_contents(public_path('images/bagong-pilipinas-logo.png'))
    );
@endphp

{{-- ── Fixed page header ── --}}
<div class="page-header">
    <table class="header-inner">
        <tr>
            <td class="header-logo-left"><img src="{{ $denrLogo }}" alt="DENR Logo"></td>
            <td class="header-center">
                <div class="header-republic">Republic of the Philippines</div>
                <div class="header-agency">Department of Environment and Natural Resources</div>
                <div class="header-filipino">Kagawaran ng Kapaligiran at Likas na Yaman</div>
                <div class="header-office">PENRO Catanduanes</div>
            </td>
            <td class="header-logo-right"><img src="{{ $bagongPilipinasLogo }}" alt="Bagong Pilipinas Logo"></td>
        </tr>
    </table>
</div>

{{-- ── Fixed page footer ── --}}
<div class="page-footer">
    <table class="footer-inner">
        <tr>
            <td class="footer-contact">
                San Isidro Village, Virac, Catanduanes, Philippines<br>
                penrocatanduanes@denr.gov.ph &nbsp;&nbsp;|&nbsp;&nbsp; (052) 740-5735 &nbsp;&nbsp;|&nbsp;&nbsp; VOIP: 2841
            </td>
            @if (!empty($qrPngDataUri))
            <td class="footer-qr">
                <img src="{{ $qrPngDataUri }}" alt="QR Code">
                <p>Scan to verify</p>
            </td>
            @endif
        </tr>
    </table>
</div>

{{-- ── Document title ── --}}
<div class="doc-title-block">
    <div class="doc-title">Custody Receipt</div>
    <div class="doc-subtitle">
        @if($isTurnedOver) Voluntary Turnover @else Apprehension @endif
    </div>
</div>

{{-- ── Intro ── --}}
<p class="intro">
    @if($isTurnedOver)
        I HEREBY ACKNOWLEDGE RECEIPT for temporary safekeeping the following items listed below
        which were voluntarily turned over to DENR-PENRO Catanduanes in accordance with forestry
        laws, rules, and regulations.
    @else
        I HEREBY ACKNOWLEDGE RECEIPT for temporary safekeeping from the apprehending officers the
        following items listed below which were apprehended for violation of forestry laws, rules,
        and regulations.
    @endif
</p>

{{-- ── Items table ── --}}
<table class="items">
    <thead>
        <tr>
            <th class="col-qty">Quantity</th>
            <th class="col-item">Item / Type</th>
            <th class="col-details">Details</th>
        </tr>
    </thead>
    <tbody>
        @forelse($groupedItems as $item)
        <tr>
            <td class="qty-cell">
                {{ $item->quantity }}
            </td>
            <td>{{ $item->type_label }}</td>
            <td>
                @if(in_array($item->asset_type, ['log', 'wildlife']) && $item->species)
                    <small>Species:</small> {{ $item->species }}<br>
                @endif
                @if($item->volume_bd_ft)
                    <small>Volume:</small> {{ number_format($item->volume_bd_ft, 2) }} bd.ft
                    @if($item->volume_cu_m)
                        / {{ number_format($item->volume_cu_m, 4) }} cu.m
                    @endif
                    <br>
                @elseif($item->volume_cu_m)
                    <small>Volume:</small> {{ number_format($item->volume_cu_m, 4) }} cu.m<br>
                @endif
                @if($item->equipment_type)
                    <small>Equipment Type:</small> {{ $item->equipment_type }}<br>
                @endif
                @if($item->vehicle_type)
                    <small>Vehicle Type:</small> {{ $item->vehicle_type }}<br>
                @endif
                @if($item->description)
                    <small>Description:</small> {{ $item->description }}<br>
                @endif
                @if($item->plate_number)
                    <small>Plate / Conveyance No.:</small> {{ $item->plate_number }}<br>
                @endif
                @if($item->serial_number)
                    <small>Serial No.:</small> {{ $item->serial_number }}<br>
                @endif
                @if(!$item->volume_bd_ft && !$item->volume_cu_m && !$item->species && !$item->equipment_type && !$item->vehicle_type && !$item->description && !$item->plate_number && !$item->serial_number)
                    —
                @endif
            </td>
        </tr>
        @empty
        <tr>
            <td class="empty-cell" colspan="3">No items recorded.</td>
        </tr>
        @endforelse
    </tbody>
</table>

{{-- ── Custodian note ── --}}
<p class="custodian-note">
    As temporary custodian thereof, I shall ensure the safety and be responsible for their loss
    or damage while the same is in my possession and shall not deliver or release to anyone
    except upon orders only of the DENR.
</p>

<hr class="section-divider">

{{-- ── Meta info ── --}}
<div class="meta-grid">
    <div class="meta-row">
        <div class="meta-label">{{ $isTurnedOver ? 'Date of Turnover:' : 'Date of Issuance:' }}</div>
        <div class="meta-value">{{ $receipt->created_at?->format('F d, Y') ?? now()->format('F d, Y') }}</div>
    </div>
    <div class="meta-row">
        <div class="meta-label">Place of Issuance:</div>
        <div class="meta-value">DENR-PENRO Catanduanes, San Isidro Village, Virac, Catanduanes</div>
    </div>
    @if($isTurnedOver)
    <div class="meta-row">
        <div class="meta-label">STCP No.:</div>
        <div class="meta-value">{{ $asset->stcp_number ?? '—' }}</div>
    </div>
    @else
    <div class="meta-row">
        <div class="meta-label">AAP No.:</div>
        <div class="meta-value">{{ $asset->aap_number ?? '—' }}</div>
    </div>
    @endif
</div>

{{-- ── Signatures ── --}}
<table class="signatures">
    <tr>
        <td>
            <div class="sig-name-box"></div>
            <div class="sig-label">{{ $isTurnedOver ? 'Receiving Officer' : 'Apprehending Officer' }}</div>
            <div class="sig-sublabel"></div>
            <div class="sig-sublabel-text">Rank / Position / Designation</div>
        </td>
        <td>
            <div class="sig-name-box"></div>
            <div class="sig-label">Name and Signature of Custodian</div>
            <div class="sig-sublabel"></div>
            <div class="sig-sublabel-text">Rank / Position / Designation</div>
        </td>
    </tr>
</table>

{{-- ── Witnesses ── --}}
<div class="witnesses-section">
    <div class="witnesses-title">Witnesses:</div>
    <table class="witnesses">
        <tr>
            <td>
                <div class="witness-line"></div>
                <div class="witness-label">Signature over Printed Name</div>
            </td>
            <td>
                <div class="witness-line"></div>
                <div class="witness-label">Signature over Printed Name</div>
            </td>
        </tr>
    </table>
</div>

</body>
</html>