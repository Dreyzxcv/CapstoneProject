<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UploadDisposalJevOutRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('jev.upload') ?? false;
    }

    public function rules(): array
    {
        return [];
    }
}