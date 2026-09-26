<?php

namespace App\Http\Requests;

use App\Enums\DocumentType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UploadRequiredDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('documents.upload') ?? false;
    }

    public function rules(): array
    {
        return [
            'document_type' => ['required', Rule::enum(DocumentType::class)],
            'file'          => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:8192'],
            'aap_number'    => [
                Rule::requiredIf($this->input('document_type') === 'aap_document'),
                'nullable',
                'string',
                'max:100',
            ],
            'stcp_number'   => [
                Rule::requiredIf($this->input('document_type') === 'stcp_document'),
                'nullable',
                'string',
                'max:100',
            ],
        ];
    }
}