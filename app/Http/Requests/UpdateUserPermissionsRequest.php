<?php

namespace App\Http\Requests;

use App\Support\AreaPermissions;
use Illuminate\Foundation\Http\FormRequest;

class UpdateUserPermissionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('users.manage') ?? false;
    }

    public function rules(): array
    {
        $rules = [
            'areas' => ['required', 'array', function ($attr, $value, $fail) {
                if (array_diff(array_keys($value), AreaPermissions::keys())) {
                    $fail('Unknown permission area.');
                }
            }],
        ];
        foreach (AreaPermissions::keys() as $key) {
            $rules["areas.$key"] = ['required', 'boolean'];
        }
        return $rules;
    }
}