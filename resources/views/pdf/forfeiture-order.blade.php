<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Forfeiture Order</title>
<style>body{font-family:DejaVu Sans,sans-serif;font-size:12px}h1{font-size:16px;text-align:center}table{width:100%;border-collapse:collapse;margin-top:20px}td{padding:6px;vertical-align:top}.label{font-weight:bold;width:35%}</style>
</head>
<body>
<h1>DENR-PENRO Catanduanes<br>Forfeiture Order</h1>
<p>The item described below, having been apprehended or turned over with a confiscation/forfeiture order in effect, is hereby declared forfeited in favor of the government pursuant to DENR Administrative Order No. 97-32.</p>
<table>
<tr><td class="label">Asset Code</td><td>{{ $asset->asset_code }}</td></tr>
<tr><td class="label">Type</td><td>{{ $asset->type->label() }}</td></tr>
<tr><td class="label">Species / Description</td><td>{{ $asset->species }} {{ $asset->description }}</td></tr>
<tr><td class="label">Municipality of Origin</td><td>{{ $asset->municipality_of_origin }}</td></tr>
<tr><td class="label">Location Apprehended</td><td>{{ $asset->location_apprehended }}</td></tr>
<tr><td class="label">Apprehending Agency</td><td>{{ $asset->apprehending_agency }}</td></tr>
<tr><td class="label">Mode of Intake</td><td>{{ $asset->mode->label() }}</td></tr>
<tr><td class="label">Date</td><td>{{ now()->format('F d, Y') }}</td></tr>
</table>
</body>
</html>