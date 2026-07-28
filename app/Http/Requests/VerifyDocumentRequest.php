<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class VerifyDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('documents.verify') ?? false;
    }

    public function rules(): array
    {
        return [
            'decision' => ['required', Rule::in(['verified', 'rejected'])],
            'remarks' => ['required_if:decision,rejected', 'nullable', 'string', 'max:1000'],
        ];
    }
}