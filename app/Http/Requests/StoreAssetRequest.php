<?php

namespace App\Http\Requests;

use App\Enums\AssetMode;
use App\Enums\AssetType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAssetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('assets.create');
    }

    public function rules(): array
    {
        return [
            'type' => ['required', Rule::enum(AssetType::class)],
            'species' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'municipality_of_origin' => ['required', Rule::enum(\App\Enums\Municipality::class)],
            'location_apprehended' => ['required', 'string', 'max:255'],
            'apprehending_agency' => ['required', 'string', 'max:255'],
            'mode' => ['required', Rule::enum(AssetMode::class)],
            'has_ongoing_case' => ['boolean'],
            'has_confiscation_order' => ['boolean'],
            'metadata' => ['nullable', 'array'],
        ];
    }
}
