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

    public const MAX_PIECE_QUANTITY = 500;
    public const MAX_PIECES_PER_INCIDENT = 1000;

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

            'has_confiscation_order_file' => [
                'exclude_if:intake_mode,turned_over',
                Rule::requiredIf(fn () => $this->boolean('has_confiscation_order')),
                'nullable',
                'file',
                'mimes:pdf',
                'max:10240',
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
            
            'assets.*.pieces.*.quantity' => [
                'nullable', 
                'integer', 
                'min:1', 
                'max:' . self::MAX_PIECE_QUANTITY
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
                'required',
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

    public function messages(): array
    {
        return [
            'assets.*.pieces.*.quantity.integer' => 'Quantity must be a whole number.',
            'assets.*.pieces.*.quantity.min'     => 'Quantity must be at least 1.',
            'assets.*.pieces.*.quantity.max'     => 'Quantity cannot exceed ' . self::MAX_PIECE_QUANTITY . ' per entry.',
            'assets.*.pieces.*.description.required' => 'Description is required for every piece entry.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            $total = 0;
            foreach ((array) $this->input('assets', []) as $ai => $asset) {
                foreach ((array) ($asset['pieces'] ?? []) as $pi => $piece) {
                    $key = "assets.$ai.pieces.$pi.quantity";
                    if ($v->errors()->has($key)) continue;

                    $qty = (int) ($piece['quantity'] ?? 1);
                    $total += max(1, $qty);

                    if ($qty > 1 && ($asset['type'] ?? null) === 'vehicle') {
                        $v->errors()->add($key, 'Vehicles must be entered one per entry (each has its own plate number).');
                    }
                    if ($qty > 1 && ($asset['type'] ?? null) === 'equipment' && filled($piece['serial_number'] ?? null)) {
                        $v->errors()->add($key, 'Equipment with a serial number must be entered one per entry.');
                    }
                }
            }
            if ($total > self::MAX_PIECES_PER_INCIDENT) {
                $v->errors()->add('assets', 'An incident can hold at most ' . self::MAX_PIECES_PER_INCIDENT . ' pieces in total.');
            }
        });
    }
}