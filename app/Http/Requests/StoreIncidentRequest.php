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
            'date_of_apprehension' => ['required', 'date'],
            'place_of_apprehension' => ['required', 'string', 'max:255'],
            'area' => ['nullable', 'string', 'max:255'],
            'coordinates' => ['nullable', 'string', 'max:255'],
            'claimant_offender_name' => ['nullable', 'string', 'max:255'],
            'is_abandoned' => ['boolean'],
            'apprehending_party' => ['required', 'string', 'max:255'],
            'date_report_submitted' => ['nullable', 'date'],

            'assets' => ['required', 'array', 'min:1'],
            'assets.*.type' => ['required', Rule::enum(AssetType::class)],
            'assets.*.species' => ['nullable', 'string', 'max:255'],
            'assets.*.description' => ['nullable', 'string', 'max:2000'],
            'assets.*.quantity' => ['nullable', 'integer', 'min:1'],
            'assets.*.volume_bd_ft' => ['nullable', 'numeric', 'min:0'],
            'assets.*.volume_cu_m' => ['nullable', 'numeric', 'min:0'],
            'assets.*.estimated_value' => ['nullable', 'numeric', 'min:0'],
            'assets.*.plate_number' => ['nullable', 'string', 'max:50'],
            'assets.*.municipality_of_origin' => ['required', Rule::enum(\App\Enums\Municipality::class)],
            'assets.*.location_apprehended' => ['required', 'string', 'max:255'],
            'assets.*.apprehending_agency' => ['required', 'string', 'max:255'],
            'assets.*.mode' => ['required', Rule::enum(AssetMode::class)],
            'assets.*.has_ongoing_case' => ['boolean'],
            'assets.*.has_confiscation_order' => ['boolean'],
        ];
    }
}