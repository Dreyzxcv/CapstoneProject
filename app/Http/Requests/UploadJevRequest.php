<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UploadJevRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('jev.upload');
    }

    public function rules(): array
    {
        return [];
    }
}
