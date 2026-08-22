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
            'species'                => ['nullable', 'string', 'max:255'],
            'vehicle_type'   => ['nullable', 'string', 'max:255'],
            'equipment_type' => ['nullable', 'string', 'max:255'],
            'description'            => ['nullable', 'string', 'max:2000'],
            'quantity'               => ['nullable', 'integer', 'min:1'],
            'quantity_unit'          => ['nullable', 'string', 'max:50'],
            'length'                 => ['nullable', 'numeric', 'min:0'],
            'width'                  => ['nullable', 'numeric', 'min:0'],
            'height'                 => ['nullable', 'numeric', 'min:0'],
            'volume_bd_ft'           => ['nullable', 'numeric', 'min:0'],
            'volume_cu_m'            => ['nullable', 'numeric', 'min:0'],
            'estimated_value'        => ['nullable', 'numeric', 'min:0'],
            'plate_number'           => ['nullable', 'string', 'max:50'],
            'location_apprehended'   => ['required', 'string', 'max:255'],
            'apprehending_agency'    => ['required', 'string', 'max:255'],
            'mode'                   => ['required', Rule::enum(AssetMode::class)],
            'has_ongoing_case'       => ['boolean'],
            'has_confiscation_order' => ['boolean'],
        ];
    }
}