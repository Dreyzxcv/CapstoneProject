<?php

namespace App\Http\Requests;

use App\Enums\AssetMode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAssetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('assets.update');
    }

    public function rules(): array
    {
        return [
            // Asset-level
            'location_apprehended'   => ['required', 'string', 'max:255'],
            'apprehending_agency'    => ['required', 'string', 'max:255'],
            'mode'                   => ['required', Rule::enum(AssetMode::class)],
            'has_ongoing_case'       => ['boolean'],
            'has_confiscation_order' => ['boolean'],

            // Incident-level (only present when asset has an incident)
            'date_of_apprehension'   => ['nullable', 'date'],
            'place_of_apprehension'  => ['nullable', 'string', 'max:255'],
            'area'                   => ['nullable', 'string', 'max:255'],
            'coordinates'            => ['nullable', 'string', 'max:100'],
            'apprehending_party'     => ['nullable', 'string', 'max:500'],
            'has_claimant'           => ['boolean'],
            'claimant_offender_name' => ['nullable', 'string', 'max:255'],
            'claimant_address'        => ['nullable', 'string', 'max:500'],
            'claimant_contact_number' => ['nullable', 'string', 'max:50'],
            'claimant_id_type'        => ['nullable', 'string', 'max:100'],
            'claimant_id_number'      => ['nullable', 'string', 'max:100'],
        ];
    }
}