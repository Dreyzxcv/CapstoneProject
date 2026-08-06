<?php
// app/Http/Requests/StoreBatchDonationRequest.php

namespace App\Http\Requests;

use App\Enums\DonationOrganizationType;
use App\Enums\Municipality;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBatchDonationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('disposals.process');
    }

    public function rules(): array
    {
        return [
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.asset_id' => ['required', 'integer', 'distinct', 'exists:assets,id'],
            'lines.*.quantity' => ['required', 'integer', 'min:1'],

            'requester_name' => ['required', 'string', 'max:255'],
            'organization_type' => ['required', Rule::enum(DonationOrganizationType::class)],
            'organization_type_other' => ['required_if:organization_type,other', 'nullable', 'string', 'max:255'],

            // "Donee Office / Institution Name" — always required now,
            // regardless of organization type.
            'agency_name' => ['required', 'string', 'max:255'],

            'municipality' => ['required', Rule::enum(Municipality::class)],
            'barangay' => [
                'required',
                'string',
                'max:255',
                function ($attribute, $value, $fail) {
                    $validBarangays = config('barangays')[$this->input('municipality')] ?? [];

                    if (! in_array($value, $validBarangays, true)) {
                        $fail('The selected barangay is not valid for the chosen municipality.');
                    }
                },
            ],
            'street' => ['nullable', 'string', 'max:255'],
            'delivery_coordinates' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:1000'],

            // Deed of Donation fields
            'donee_position' => ['required', 'string', 'max:255'],
            'purpose_statement' => ['required', 'string', 'max:2000'],
            'confiscation_order_reference' => ['nullable', 'string', 'max:255'],

            // OIC / donor representative — editable per document; left
            // blank falls back to config/office.php defaults.
            'donor_representative_name' => ['nullable', 'string', 'max:255'],
            'donor_representative_title' => ['nullable', 'string', 'max:255'],

            // Witnesses — editable per document; left blank falls back to
            // config/office.php defaults.
            'witness_1_name' => ['nullable', 'string', 'max:255'],
            'witness_1_title' => ['nullable', 'string', 'max:255'],
            'witness_2_name' => ['nullable', 'string', 'max:255'],
            'witness_2_title' => ['nullable', 'string', 'max:255'],
        ];
    }
}