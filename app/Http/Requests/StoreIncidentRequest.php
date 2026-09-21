<?php
// app/Http/Requests/StoreIncidentRequest.php

namespace App\Http\Requests;

use App\Enums\AssetMode;
use App\Enums\AssetType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class StoreIncidentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('incidents.create') ?? false;
    }

    public function rules(): array
    {
        return [
            'intake_mode' => [
                'required',
                Rule::enum(AssetMode::class),
            ],

            'date_of_apprehension' => [
                'required',
                'date',
            ],

            'place_of_apprehension' => [
                'required',
                'string',
                'max:255',
            ],

            'area' => [
                'nullable',
                'string',
                'max:255',
            ],

            'coordinates' => [
                'nullable',
                'string',
                'max:255',
            ],

            'has_claimant' => [
                'boolean',
            ],

            // Claimant information is not applicable to Turned Over
            'claimant_offender_name' => [
                'exclude_if:intake_mode,turned_over',
                'required_if:has_claimant,true',
                'nullable',
                'string',
                'max:255',
            ],

            'claimant_address' => [
                'exclude_if:intake_mode,turned_over',
                'required_if:has_claimant,true',
                'nullable',
                'string',
                'max:255',
            ],

            'claimant_contact_number' => [
                'exclude_if:intake_mode,turned_over',
                'nullable',
                'string',
                'max:50',
            ],

            'claimant_id_type' => [
                'exclude_if:intake_mode,turned_over',
                'nullable',
                'string',
                'max:100',
            ],

            'claimant_id_number' => [
                'exclude_if:intake_mode,turned_over',
                'nullable',
                'string',
                'max:100',
            ],

            'apprehending_party' => [
                'required',
                'string',
                'max:255',
            ],

            'initial_custodian_name' => [
                'nullable',
                'string',
                'max:255',
            ],

            'date_report_submitted' => [
                'nullable',
                'date',
            ],

            'has_ongoing_case' => [
                'boolean',
            ],

            'has_confiscation_order' => [
                'boolean',
            ],

            'assets' => [
                'required',
                'array',
                'min:1',
            ],

            'assets.*.type' => [
                'required',
                Rule::enum(AssetType::class),
            ],

            'assets.*.apprehending_agency' => [
                Rule::requiredIf(
                    $this->input('intake_mode') !== 'turned_over'
                ),
                'nullable',
                'string',
                'max:255',
            ],

            'assets.*.municipality_of_origin' => [
                'required',
                Rule::enum(\App\Enums\Municipality::class),
            ],

            'assets.*.location_apprehended' => [
                'required',
                'string',
                'max:255',
            ],

            'assets.*.mode' => [
                'required',
                Rule::enum(AssetMode::class),
            ],

            'assets.*.pieces' => [
                'required',
                'array',
                'min:1',
            ],

            'assets.*.pieces.*.species' => [
                'nullable',
                'string',
                'max:255',
            ],

            'assets.*.pieces.*.equipment_type' => [
                'nullable',
                'string',
                'max:255',
            ],

            'assets.*.pieces.*.vehicle_type' => [
                'nullable',
                'string',
                'max:255',
            ],

            'assets.*.pieces.*.description' => [
                'nullable',
                'string',
                'max:2000',
            ],

            'assets.*.pieces.*.length' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'assets.*.pieces.*.width' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'assets.*.pieces.*.height' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'assets.*.pieces.*.volume_bd_ft' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'assets.*.pieces.*.volume_cu_m' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'assets.*.pieces.*.estimated_value' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'assets.*.pieces.*.plate_number' => [
                'nullable',
                'string',
                'max:50',
            ],

            'assets.*.pieces.*.serial_number' => [
                'nullable',
                'string',
                'max:255',
            ],
        ];
    }
}