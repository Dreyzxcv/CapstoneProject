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
            'place_of_apprehension'  => ['nullable', Rule::enum(\App\Enums\Municipality::class)],
            'area'                   => ['nullable', Rule::in(['Timberland', 'Protected Area', 'Alienable & Disposable'])],
            'coordinates'            => ['nullable', 'string', 'max:100'],
            'apprehending_party'     => ['nullable', 'string', 'max:500'],
            'has_claimant' => ['boolean'],
            'claimants' => [
                Rule::requiredIf(fn () => $this->claimantsRequired()),
                'nullable', 'array', 'max:20',
            ],
            'claimants.*.name' => [
                Rule::requiredIf(fn () => $this->claimantsRequired()),
                'nullable', 'string', 'max:255',
            ],
            'claimants.*.address' => [
                Rule::requiredIf(fn () => $this->claimantsRequired()),
                'nullable', 'string', 'max:500',
            ],
            'claimants.*.contact_number' => ['nullable', 'string', 'max:50'],
            'claimants.*.id_type'        => ['nullable', 'string', 'max:100'],
            'claimants.*.id_number'      => ['nullable', 'string', 'max:100'],
        ];
    }

    protected function claimantsRequired(): bool
    {
        return $this->boolean('has_claimant') && $this->input('mode') !== 'turned_over';
    }
}