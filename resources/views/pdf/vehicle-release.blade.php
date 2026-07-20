<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Release Order</title>
<style>body{font-family:DejaVu Sans,sans-serif;font-size:12px}h1{font-size:16px;text-align:center}</style>
</head>
<body>
<h1>DENR-PENRO Catanduanes<br>Release Order</h1>
<p>The conveyance described below is hereby released back to its owner following a timely appeal within the 15-day window, subject to the resolution of the court or regional office, since PENRO Catanduanes does not have jurisdiction over the final disposition of appealed conveyances.</p>
<p><strong>Asset Code:</strong> {{ $asset->asset_code }}</p>
<p><strong>Plate Number:</strong> {{ $asset->plate_number ?? '—' }}</p>
<p><strong>Owner / Claimant:</strong> {{ $asset->incident?->claimant_offender_name ?? 'Unknown' }}</p>
<p><strong>Appeal Deadline:</strong> {{ $asset->appeal_deadline?->format('F d, Y') ?? '—' }}</p>
<p><strong>Date Released:</strong> {{ $disposal->processed_at->format('F d, Y') }}</p>
</body>
</html>