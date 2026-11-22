<?php

namespace App\Http\Requests;

use App\Models\User;
use App\Support\AreaPermissions;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('users.manage') ?? false;
    }

    protected function prepareForValidation(): void
    {
        $name = $this->input('name');
        $email = $this->input('email');

        $this->merge([
            'name' => is_string($name) ? trim(preg_replace('/\s+/u', ' ', $name)) : $name,
            'email' => is_string($email) ? mb_strtolower(trim($email)) : $email,
        ]);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required', 'string', 'email', 'max:255',
                // Case-insensitive on every DB driver, not just MySQL's default collation.
                function (string $attribute, mixed $value, \Closure $fail) {
                    if (User::whereRaw('LOWER(email) = ?', [mb_strtolower($value)])->exists()) {
                        $fail('That email address is already registered.');
                    }
                },
            ],
            // 'string' rejects arrays, so role[]=A&role[]=B fails validation.
            'role' => ['required', 'string', Rule::exists('roles', 'name')->where('guard_name', 'web')],
            'acknowledge_privileged' => $this->roleIsPrivileged()
                ? ['accepted']
                : ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'acknowledge_privileged.accepted' => 'Please confirm you want to grant this privileged role.',
        ];
    }

    private function roleIsPrivileged(): bool
    {
        $role = $this->input('role');
        if (! is_string($role)) {
            return false;
        }

        return Role::where('name', $role)->where('guard_name', 'web')->first()
            ?->permissions->pluck('name')->intersect(AreaPermissions::ADMIN_ONLY)->isNotEmpty() ?? false;
    }
}