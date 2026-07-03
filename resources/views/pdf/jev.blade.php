<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Journal Entry Voucher</title>
    <style>
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 10px;
            margin: 0;
            padding: 0;
            color: #000;
        }

        .page {
            padding: 16px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        td, th {
            padding: 5px 8px;
            vertical-align: top;
        }

        .bordered, .bordered td, .bordered th {
            border: 1px solid #000;
        }

        .no-border td {
            border: none;
        }

        .title {
            font-size: 15px;
            font-weight: bold;
        }

        .subtitle {
            font-size: 9px;
            line-height: 1.3;
        }

        .label {
            font-size: 8px;
            font-weight: bold;
            text-transform: uppercase;
            color: #333;
        }

        .value {
            font-size: 10px;
        }

        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .small { font-size: 8.5px; }
        .bold { font-weight: bold; }

        .signature-block {
            padding-top: 26px;
        }

        .signature-name {
            font-weight: bold;
            border-top: 1px solid #000;
            display: inline-block;
            padding-top: 2px;
            min-width: 220px;
        }
    </style>
</head>
<body>
    <div class="page">

        {{-- Header block: title / funding source / JEV number, then transaction type / date --}}
        <table class="bordered">
            <tr>
                <td style="width: 34%;" rowspan="2">
                    <div class="title">Journal Entry Voucher</div>
                    <div class="subtitle">
                        Department of Environment and Natural Resources<br>
                        Provincial Environment and Natural Resources Office<br>
                        {{ $officeName ?? 'PENRO Catanduanes' }}
                    </div>
                </td>
                <td style="width: 40%;">
                    <div class="label">Funding Source</div>
                    <div class="value">
                        ({{ $jev->funding_source_code ?? '01101101' }})
                        {{ $jev->funding_source_label ?? 'Regular Agency Fund - General Fund - New General Appropriations - Specific Budgets of National Government Agencies' }}
                    </div>
                </td>
                <td style="width: 26%;">
                    <div class="label">No.</div>
                    <div class="value bold">JEV-{{ $jev->jev_number }}</div>
                </td>
            </tr>
            <tr>
                <td>
                    <div class="label">Transaction Type</div>
                    <div class="value">
                        {{ $jev->transaction_type ?? 'Other Adjustments' }}
                        @if($jev->transaction_code) - {{ $jev->transaction_code }} @endif
                    </div>
                </td>
                <td>
                    <div class="label">Date</div>
                    <div class="value">{{ $jev->created_at->format('F j, Y') }}</div>
                </td>
            </tr>
        </table>

        {{-- Account entries --}}
        <table class="bordered" style="margin-top: 8px;">
            <tr>
                <th style="width: 16%;">Responsibility<br>Center</th>
                <th style="width: 34%;">Account Title</th>
                <th style="width: 12%;">Account<br>Code</th>
                <th style="width: 12%;">Sub-Object<br>Code</th>
                <th style="width: 13%;">Debit</th>
                <th style="width: 13%;">Credit</th>
            </tr>
            @php $lines = $jev->line_items ?? []; @endphp
            @forelse($lines as $i => $line)
                <tr>
                    <td class="text-center">{{ $i === 0 ? ($jev->responsibility_center ?? '—') : '' }}</td>
                    <td>{{ $line['account_title'] ?? '' }}</td>
                    <td class="text-center">{{ $line['account_code'] ?? '' }}</td>
                    <td class="text-center">{{ $line['sub_object_code'] ?? '00' }}</td>
                    <td class="text-right">{{ !empty($line['debit']) ? number_format($line['debit'], 2) : '' }}</td>
                    <td class="text-right">{{ !empty($line['credit']) ? number_format($line['credit'], 2) : '' }}</td>
                </tr>
            @empty
                <tr>
                    <td class="text-center">{{ $jev->responsibility_center ?? '—' }}</td>
                    <td colspan="3" class="small">No line items recorded.</td>
                    <td class="text-right">0.00</td>
                    <td class="text-right">0.00</td>
                </tr>
            @endforelse
            <tr>
                <td colspan="4" class="text-right bold">TOTAL</td>
                <td class="text-right bold">{{ number_format($jev->totalDebit(), 2) }}</td>
                <td class="text-right bold">{{ number_format($jev->totalCredit(), 2) }}</td>
            </tr>
        </table>

        {{-- Supporting documents --}}
        <table class="bordered" style="margin-top: 8px;">
            <tr>
                <td style="width: 20%;">
                    <div class="label">Supporting Documents</div>
                </td>
                <td style="width: 55%;">
                    <div class="value small">
                        {{ $asset->metadata['supporting_documents'] ?? ('E-FMS No. ' . ($asset->metadata['efms_number'] ?? '__________')) }}
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="label">Document No</div>
                    <div class="value">{{ $jev->document_no ?? '—' }}</div>
                </td>
            </tr>
        </table>

        {{-- Particulars --}}
        <table class="bordered" style="margin-top: 8px;">
            <tr>
                <td style="width: 14%;"><div class="label">Particulars</div></td>
                <td>
                    <div class="value small">
                        {{ $jev->particulars ?? 'Recording of forest products and conveyances with confiscation and forfeiture orders.' }}
                    </div>
                </td>
            </tr>
        </table>

        {{-- Signatures --}}
        <table class="no-border" style="margin-top: 22px;">
            <tr>
                <td style="width: 15%;" class="small">Prepared by:</td>
                <td style="width: 35%;">
                    <div class="signature-block">
                        <span class="signature-name">
                            {{ $jev->prepared_by_name ?? $jev->createdByAccounting?->name ?? '_________________________' }}
                        </span>
                    </div>
                </td>
                <td style="width: 15%;" class="small">Approved by:</td>
                <td style="width: 35%;">
                    <div class="signature-block">
                        <span class="signature-name">
                            {{ $jev->approved_by_name ?? $jev->uploadedByMes?->name ?? '_________________________' }}
                        </span>
                    </div>
                </td>
            </tr>
        </table>

        <p class="small" style="margin-top: 18px;">
            Date Printed: {{ now()->format('l, F j, Y') }}
        </p>
    </div>
</body>
</html>