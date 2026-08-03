<?php

namespace App\Http\Requests;

use App\Enums\DisposalType;
use App\Enums\Municipality;
use Illuminate\Foundation\Http\FormRequest;
use App\Enums\DonationOrganizationType;
use Illuminate\Validation\Rule;

class ProcessDisposalRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('disposals.process');
    }

    public function rules(): array
    {
        return [
            'disposal_type' => ['required', Rule::enum(DisposalType::class)],
            'quantity' => ['nullable', 'integer', 'min:1'],
            'requester_name' => ['required_if:disposal_type,donation', 'nullable', 'string', 'max:255'],
            'delivery_coordinates' => ['nullable', 'string', 'max:255'],
            'organization_type' => ['required_if:disposal_type,donation', Rule::enum(DonationOrganizationType::class)],
            'organization_type_other' => ['required_if:organization_type,other', 'nullable', 'string', 'max:255'],
            'agency_name' => ['nullable', 'required_unless:organization_type,individual', 'string', 'max:255'],

            'municipality' => ['required_if:disposal_type,donation', 'nullable', Rule::enum(Municipality::class)],
            'barangay' => [
                'required_if:disposal_type,donation',
                'nullable',
                'string',
                'max:255',
                function ($attribute, $value, $fail) {
                    if ($this->input('disposal_type') !== 'donation' || ! $value) {
                        return;
                    }

                    $municipality = $this->input('municipality');
                    $validBarangays = config('barangays')[$municipality] ?? [];

                    if (! in_array($value, $validBarangays, true)) {
                        $fail('The selected barangay is not valid for the chosen municipality.');
                    }
                },
            ],
            'street' => ['nullable', 'string', 'max:255'],

            // Deed of Donation fields
            'donee_position' => ['required_if:disposal_type,donation', 'nullable', 'string', 'max:255'],
            'purpose_statement' => ['required_if:disposal_type,donation', 'nullable', 'string', 'max:2000'],
            'confiscation_order_reference' => ['nullable', 'string', 'max:255'],
            'donor_representative_name' => ['nullable', 'string', 'max:255'],
            'donor_representative_title' => ['nullable', 'string', 'max:255'],
            'witness_1_name' => ['nullable', 'string', 'max:255'],
            'witness_1_title' => ['nullable', 'string', 'max:255'],
            'witness_2_name' => ['nullable', 'string', 'max:255'],
            'witness_2_title' => ['nullable', 'string', 'max:255'],

            'appeal_filed' => ['nullable', 'boolean'],
            'details' => ['nullable', 'array'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}