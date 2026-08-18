<?php
// app/Http/Requests/StoreIncidentRequest.php

namespace App\Http\Requests;

use App\Enums\AssetMode;
use App\Enums\AssetType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreIncidentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('incidents.create') ?? false;
    }

    public function rules(): array
    {
        return [
            'date_of_apprehension'    => ['required', 'date'],
            'place_of_apprehension'   => ['required', 'string', 'max:255'],
            'area'                    => ['nullable', 'string', 'max:255'],
            'coordinates'             => ['nullable', 'string', 'max:255'],
            'has_claimant'            => ['boolean'],
            'claimant_offender_name'  => ['required_if:has_claimant,true', 'nullable', 'string', 'max:255'],
            'claimant_address'        => ['required_if:has_claimant,true', 'nullable', 'string', 'max:255'],
            'claimant_contact_number' => ['nullable', 'string', 'max:50'],
            'claimant_id_type'        => ['nullable', 'string', 'max:100'],
            'claimant_id_number'      => ['nullable', 'string', 'max:100'],
            'apprehending_party'      => ['required', 'string', 'max:255'],
            'initial_custodian_name'  => ['nullable', 'string', 'max:255'],
            'date_report_submitted'   => ['nullable', 'date'],

            // Asset-level (container) fields
            'assets'                              => ['required', 'array', 'min:1'],
            'assets.*.type'                       => ['required', Rule::enum(AssetType::class)],
            'assets.*.description'                => ['nullable', 'string', 'max:2000'],
            'assets.*.apprehending_agency'        => ['required', 'string', 'max:255'],
            'assets.*.municipality_of_origin'     => ['required', Rule::enum(\App\Enums\Municipality::class)],
            'assets.*.location_apprehended'       => ['required', 'string', 'max:255'],
            'assets.*.mode'                       => ['required', Rule::enum(AssetMode::class)],
            'assets.*.has_ongoing_case'           => ['boolean'],
            'assets.*.has_confiscation_order'     => ['boolean'],

            // Per-piece fields — each item is now encoded piece-by-piece
            'assets.*.pieces'                     => ['required', 'array', 'min:1'],
            'assets.*.pieces.*.species'           => ['nullable', 'string', 'max:255'],
            'assets.*.pieces.*.description'       => ['nullable', 'string', 'max:2000'],
            'assets.*.pieces.*.length'            => ['nullable', 'numeric', 'min:0'],
            'assets.*.pieces.*.width'             => ['nullable', 'numeric', 'min:0'],
            'assets.*.pieces.*.height'            => ['nullable', 'numeric', 'min:0'],
            'assets.*.pieces.*.volume_bd_ft'      => ['nullable', 'numeric', 'min:0'],
            'assets.*.pieces.*.volume_cu_m'       => ['nullable', 'numeric', 'min:0'],
            'assets.*.pieces.*.estimated_value'   => ['nullable', 'numeric', 'min:0'],
            'assets.*.pieces.*.plate_number'      => ['nullable', 'string', 'max:50'],
        ];
    }
}