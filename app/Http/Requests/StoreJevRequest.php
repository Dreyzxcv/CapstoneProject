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
        ];
    }
}