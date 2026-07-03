<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreJevRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('jev.create');
    }

    public function rules(): array
    {
        return [
            'jev_number' => ['required', 'string', 'max:100', 'unique:jevs,jev_number'],
            'funding_source_code' => ['nullable', 'string', 'max:50'],
            'funding_source_label' => ['nullable', 'string', 'max:500'],
            'transaction_type' => ['nullable', 'string', 'max:255'],
            'transaction_code' => ['nullable', 'string', 'max:50'],
            'responsibility_center' => ['nullable', 'string', 'max:100'],
            'particulars' => ['nullable', 'string', 'max:2000'],
            'document_no' => ['nullable', 'string', 'max:100'],
            'prepared_by_name' => ['nullable', 'string', 'max:255'],
            'approved_by_name' => ['nullable', 'string', 'max:255'],
            'line_items' => ['nullable', 'array'],
            'line_items.*.account_title' => ['required_with:line_items', 'string', 'max:255'],
            'line_items.*.account_code' => ['nullable', 'string', 'max:50'],
            'line_items.*.sub_object_code' => ['nullable', 'string', 'max:50'],
            'line_items.*.debit' => ['nullable', 'numeric', 'min:0'],
            'line_items.*.credit' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}