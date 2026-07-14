<?php
// app/Http/Requests/UpdateCaseDetailsRequest.php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCaseDetailsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('assets.update_case') ?? false;
    }

    public function rules(): array
    {
        return [
            'case_number' => ['nullable', 'string', 'max:100'],
            'court_branch' => ['nullable', 'string', 'max:255'],
            'next_hearing_date' => ['nullable', 'date'],
        ];
    }
}