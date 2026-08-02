<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreDisposalJevOutRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('jev.create') ?? false;
    }

    public function rules(): array
    {
        return [
            'jev_number' => ['required', 'string', 'max:100', 'unique:disposal_jevs,jev_number'],
        ];
    }
}