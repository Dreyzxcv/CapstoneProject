<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Deed of Donation</title>
<style>body{font-family:DejaVu Sans,sans-serif;font-size:12px}h1{font-size:16px;text-align:center}</style>
</head>
<body>
<h1>Deed of Donation</h1>
<p><strong>Donee:</strong> {{ $donation->requester_name }}</p>
@if($donation->agency_name)
<p><strong>Agency/Organization:</strong> {{ $donation->agency_name }}</p>
@endif
@if($donation->organization_type)
<p><strong>Organization Type:</strong>
    {{ $donation->organization_type === \App\Enums\DonationOrganizationType::Other
        ? $donation->organization_type_other
        : $donation->organization_type->label() }}
</p>
@endif
</body>
</html>
