<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Release Order</title>
<style>body{font-family:DejaVu Sans,sans-serif;font-size:12px}h1{font-size:16px;text-align:center}table{width:100%;border-collapse:collapse;margin-top:20px}td{padding:6px;vertical-align:top}.label{font-weight:bold;width:35%}</style>
</head>
<body>
<h1>DENR-PENRO Catanduanes<br>Release Order — Donation</h1>
<p>The confiscated forest product(s) described below are hereby released for donation pursuant to DENR Administrative Order No. 97-32, following issuance of the corresponding Journal Entry Voucher (JEV Out).</p>
<table>
<tr><td class="label">Asset Code</td><td>{{ $asset->asset_code }}</td></tr>
<tr><td class="label">Species / Description</td><td>{{ $asset->species }} {{ $asset->description }}</td></tr>
<tr><td class="label">Quantity Released</td><td>{{ $disposal->quantity }}</td></tr>
<tr><td class="label">Donee</td><td>{{ $donation->requester_name }}</td></tr>
@if($donation->agency_name)
<tr><td class="label">Agency / Organization</td><td>{{ $donation->agency_name }}</td></tr>
@endif
<tr><td class="label">JEV Out No.</td><td>{{ $disposalJev->jev_number ?? '—' }}</td></tr>
<tr><td class="label">Date</td><td>{{ now()->format('F d, Y') }}</td></tr>
</table>
</body>
</html>