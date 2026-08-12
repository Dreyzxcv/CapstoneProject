<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateAapNumberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('assets.update_aap') ?? false;
    }

    public function rules(): array
    {
        return [
            'aap_number' => ['nullable', 'string', 'max:255'],
        ];
    }
}