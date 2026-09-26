<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $asset->mode?->value === 'turned_over' ? 'Custody Receipt — Turned Over' : 'Custody Receipt' }}</title>

    <style>
        @page {
            margin-top: 1.6in;
            margin-bottom: 1.1in;
            margin-left: 0.5in;
            margin-right: 0.5in;
            size: 8.5in 14in;
        }

        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            color: #000;
        }

        .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 0;
        }
        .header-table td { vertical-align: middle; text-align: center; padding: 0; }
        .header-logo-left, .header-logo-right { width: 15%; }
        .header-logo-left img, .header-logo-right img { width: 0.92in; height: auto; }
        .header-title { font-weight: bold; font-size: 12pt; margin: 0; }
        .header-subtitle { font-size: 12pt; font-weight: normal; margin: 0; }

        h3.receipt-title {
            text-align: center;
            font-size: 13pt;
            font-weight: bold;
            margin: 14pt 0 10pt;
        }

        p.intro, p.custodian-note {
            text-indent: 0.5in;
            text-align: justify;
            line-height: 1.3;
            margin: 0 0 12pt;
        }

        /* ── Fixed-layout items table ── */
        table.items {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14pt;
            table-layout: fixed;
        }

        table.items th {
            border: 1pt solid #000;
            padding: 4pt 6pt;
            font-weight: bold;
            text-align: center;
            background: #f2f2f2;
            font-size: 11pt;
        }

        table.items th.col-qty  { width: 18%; }
        table.items th.col-item { width: 35%; }
        table.items th.col-desc { width: 47%; }

        table.items td {
            border: 1pt solid #000;
            padding: 5pt 7pt;
            vertical-align: top;
            font-size: 11pt;
            /* let rows grow with content instead of a fixed height */
        }

        table.items td.empty-cell {
            height: 3in;
        }

        .meta-line { margin: 0 0 4pt; }
        .meta-line .value {
            display: inline-block;
            border-bottom: 1pt solid #000;
            min-width: 3in;
            padding-bottom: 1pt;
        }

        table.signatures {
            width: 100%;
            border-collapse: collapse;
            margin-top: 46pt;
        }
        table.signatures td { width: 50%; text-align: center; vertical-align: bottom; }
        .sig-space { height: 30pt; }
        .sig-line {
            border-top: 1pt solid #000;
            margin: 0 20pt;
            padding-top: 3pt;
            font-size: 12pt;
        }

        .witness-title { margin-top: 26pt; margin-bottom: 6pt; font-weight: bold; }
        table.witnesses { width: 100%; border-collapse: collapse; }
        table.witnesses td { width: 50%; padding-top: 24pt; }
        .witness-line { border-top: 1pt solid #000; margin: 0 20pt; }

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
        .footer-table { width: 100%; border-collapse: collapse; }
        .footer-table td { vertical-align: middle; }
        .footer-contact { text-align: center; }
        .footer-qr { text-align: right; width: 80pt; }
        .footer-qr img { width: 68pt; height: 68pt; display: block; margin-left: auto; }
        .footer-qr p { margin: 2pt 0 0; font-size: 7pt; text-align: center; font-style: normal; }
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

<h3 class="receipt-title">CUSTODY RECEIPT</h3>

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

<table class="items">
    <tr>
        <th class="col-qty">Quantity</th>
        <th class="col-item">Items</th>
        <th class="col-desc">Description</th>
    </tr>

    @forelse($groupedItems as $item)
    <tr>
        {{-- Quantity --}}
        <td style="text-align:center;">
            {{ $item->quantity }}
            @if($item->volume_bd_ft)
                <br><small>{{ number_format($item->volume_bd_ft, 2) }} bd.ft</small>
            @endif
            @if($item->volume_cu_m)
                <br><small>{{ number_format($item->volume_cu_m, 4) }} cu.m</small>
            @endif
        </td>

        {{-- Item --}}
        <td>
            {{ $item->type_label }}
            @if($item->species) — {{ $item->species }}
            @elseif($item->equipment_type) — {{ $item->equipment_type }}
            @elseif($item->vehicle_type) — {{ $item->vehicle_type }}
            @endif
        </td>

        {{-- Description --}}
        <td>
            {{ $item->description ?? '—' }}
            @if($item->plate_number)
                <br>Plate/Conveyance No.: {{ $item->plate_number }}
            @endif
            @if($item->serial_number)
                <br>Serial No.: {{ $item->serial_number }}
            @endif
        </td>
    </tr>
    @empty
    <tr>
        <td class="empty-cell" colspan="3" style="text-align:center; color:#999;">
            No items recorded.
        </td>
    </tr>
    @endforelse
</table>

<p class="custodian-note">
    As temporary custodian thereof, I shall ensure the safety and be responsible for their loss
    or damage while the same is in my possession and shall not deliver or release to anyone
    except upon orders only of the DENR.
</p>

<p class="meta-line">
    {{ $isTurnedOver ? 'Date of Turnover:' : 'Date of Issuance:' }}
    <span class="value">{{ $receipt->created_at?->format('F d, Y') ?? now()->format('F d, Y') }}</span>
</p>

<p class="meta-line">
    Place of Issuance:
    <span class="value">DENR-PENRO Catanduanes, San Isidro Village, Virac, Catanduanes</span>
</p>

@if($isTurnedOver)
<p class="meta-line">
    STCP No.:
    <span class="value">{{ $asset->stcp_number ?? '—' }}</span>
</p>
@else
<p class="meta-line">
    AAP No.:
    <span class="value">{{ $asset->aap_number ?? '—' }}</span>
</p>
@endif

<table class="signatures">
    <tr>
        <td>
            <div class="sig-space"></div>
            <div class="sig-line">
                {{ $isTurnedOver ? 'Receiving Officer' : 'Apprehending Officer' }}
            </div>
        </td>
        <td>
            <div class="sig-space"></div>
            <div class="sig-line">Name and Signature of Custodian</div>
        </td>
    </tr>
    <tr>
        <td>
            <div class="sig-space" style="height:16pt;"></div>
            <div class="sig-line">Rank/Position/Designation</div>
        </td>
        <td>
            <div class="sig-space" style="height:16pt;"></div>
            <div class="sig-line">Rank/Position/Designation</div>
        </td>
    </tr>
</table>

<p class="witness-title">WITNESSES:</p>

<table class="witnesses">
    <tr>
        <td><div class="witness-line"></div></td>
        <td><div class="witness-line"></div></td>
    </tr>
</table>

<div class="page-footer">
    <table class="footer-table">
        <tr>
            <td class="footer-contact">
                San Isidro Village, Virac, Catanduanes, Philippines<br>
                eMail: penrocatanduanes@denr.gov.ph |
                Tel. no. (052) 740 5735 |
                VOIP: 2841
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

</body>
</html>