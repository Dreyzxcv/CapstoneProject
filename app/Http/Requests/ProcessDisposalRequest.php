<?php

namespace App\Http\Requests;

use App\Enums\DisposalType;
use Illuminate\Foundation\Http\FormRequest;
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
            'appeal_filed' => ['nullable', 'boolean'],
            'details' => ['nullable', 'array'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}