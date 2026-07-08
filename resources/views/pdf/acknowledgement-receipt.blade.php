<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Custody Receipt</title>
    <style>
        @page {
            margin: 0.5in;
            size: 8.5in 14in; /* Legal — matches the source template exactly */
        }

        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            color: #000;
        }

        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
        .header-table td { vertical-align: middle; text-align: center; padding: 0; }
        .header-logo-left img { width: 0.92in; height: 0.85in; }
        .header-logo-right img { width: 0.92in; height: 0.92in; }
        .header-title { font-weight: bold; font-size: 12pt; }
        .header-subtitle { font-size: 12pt; font-weight: normal; }

        h3.receipt-title {
            text-align: center;
            font-size: 12pt;
            font-weight: bold;
            margin: 18pt 0 12pt;
        }

        p.intro, p.custodian-note {
            text-indent: 0.5in;
            text-align: justify;
            line-height: 1.3;
            margin: 0 0 12pt;
        }

        table.items { width: 100%; border-collapse: collapse; margin-bottom: 14pt; }
        table.items th {
            border: 1pt solid #000;
            padding: 4pt 6pt;
            font-weight: normal;
            text-align: center;
            width: 33.33%;
        }
        table.items td.item-cell {
            border: 1pt solid #000;
            padding: 6pt 8pt;
            vertical-align: top;
            width: 33.33%;
            height: 4.4in; /* preserves the template's single tall empty row */
        }
        .item-entry { margin: 0 0 8pt; }
        .item-entry:last-child { margin-bottom: 0; }

        .meta-line { margin: 0 0 4pt; }
        .meta-line .value {
            display: inline-block;
            border-bottom: 1pt solid #000;
            min-width: 3in;
            padding-bottom: 1pt;
        }

        table.signatures { width: 100%; border-collapse: collapse; margin-top: 30pt; }
        table.signatures td { width: 50%; text-align: center; vertical-align: bottom; }
        .sig-space { height: 30pt; }
        .sig-line { border-top: 1pt solid #000; margin: 0 20pt; padding-top: 3pt; font-size: 12pt; }

        .witness-title { margin-top: 22pt; margin-bottom: 6pt; }
        table.witnesses { width: 100%; border-collapse: collapse; }
        table.witnesses td { width: 50%; padding-top: 24pt; }
        .witness-line { border-top: 1pt solid #000; margin: 0 20pt; }

        .footer {
            margin-top: 26pt;
            text-align: center;
            font-size: 9pt;
            font-style: italic;
        }
    </style>
</head>
<body>

    @php
        $items = $items ?? collect([$asset]);
    @endphp

    <table class="header-table">
        <tr>
            <td class="header-logo-left" style="width: 15%;">
                <img src="{{ public_path('images/denr-logo.jpg') }}">
            </td>
            <td style="width: 70%;">
                <div class="header-title">DEPARTMENT OF ENVIRONMENT AND NATURAL RESOURCES</div>
                <div class="header-subtitle">KAGAWARAN NG KAPALIGIRAN AT LIKAS NA YAMAN</div>
            </td>
            <td class="header-logo-right" style="width: 15%;">
                <img src="{{ public_path('images/bagong-pilipinas-logo.png') }}">
            </td>
        </tr>
    </table>

    <h3 class="receipt-title">CUSTODY RECEIPT</h3>

    <p class="intro">
        I HEREBY ACKNOWLEDGE RECEIPT for temporary safekeeping from the apprehending officers the
        following items listed below which were apprehended for violation of forestry laws, rules,
        and regulation.
    </p>

    <table class="items">
        <tr>
            <th>Quantity</th>
            <th>Items</th>
            <th>Description</th>
        </tr>
        <tr>
            <td class="item-cell">
                @foreach($items as $item)
                    <p class="item-entry">{{ $item->quantity ?? 1 }}</p>
                @endforeach
            </td>
            <td class="item-cell">
                @foreach($items as $item)
                    <p class="item-entry">
                        {{ $item->type->label() }}
                        @if($item->species) &mdash; {{ $item->species }} @endif
                    </p>
                @endforeach
            </td>
            <td class="item-cell">
                @foreach($items as $item)
                    <p class="item-entry">
                        {{ $item->description ?? '—' }}
                        @if($item->plate_number) <br>Plate/Conveyance No.: {{ $item->plate_number }} @endif
                        @if($item->volume_bd_ft) <br>Volume: {{ $item->volume_bd_ft }} bd.ft @endif
                    </p>
                @endforeach
            </td>
        </tr>
    </table>

    <p class="custodian-note">
        As temporary custodian thereof, I shall ensure the safety and be responsible for their loss
        or damage while the same is in my possession and shall not deliver or release to anyone
        except upon orders only of the DENR.
    </p>

    <p class="meta-line">
        Date of Issuance:
        <span class="value">{{ $receipt->created_at?->format('F d, Y') ?? now()->format('F d, Y') }}</span>
    </p>
    <p class="meta-line">
        Place of Issuance:
        <span class="value">DENR-PENRO Catanduanes, San Isidro Village, Virac, Catanduanes</span>
    </p>

    <table class="signatures">
        <tr>
            <td>
                <div class="sig-space"></div>
                <div class="sig-line">Apprehending Officer</div>
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

    <div class="footer">
        San Isidro Village, Virac, Catanduanes, Philippines<br>
        eMail: penrocatanduanes@denr.gov.ph | Tel. no. (052) 740 5735 | VOIP: 2841
    </div>

</body>
</html>