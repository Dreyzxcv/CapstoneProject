<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;
use App\Support\AreaPermissions;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'email', 'password', 'is_active', 'last_login_at'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;
    use HasRoles {
        hasPermissionTo as protected spatieHasPermissionTo;
    }

    private ?array $overrideCache = null;

    public function permissionOverrides(): HasMany
    {
        return $this->hasMany(UserPermissionOverride::class);
    }

    public function isSystemAdmin(): bool
    {
        return $this->hasRole(AreaPermissions::ADMIN_ROLE);
    }

    /** @return array<string,bool> view-permission => allowed; configurable permissions only */
    public function permissionOverrideMap(): array
    {
        return $this->overrideCache ??= $this->permissionOverrides
            ->whereIn('permission', AreaPermissions::viewPermissions())
            ->pluck('allowed', 'permission')
            ->map(fn ($v) => (bool) $v)
            ->all();
    }

    public function forgetPermissionOverrides(): void
    {
        $this->overrideCache = null;
        $this->unsetRelation('permissionOverrides');
    }

    public function roleGrantsPermission(string $permission): bool
    {
        return $this->roles->contains(fn ($r) => $r->permissions->contains('name', $permission));
    }

    public function hasPermissionTo($permission, $guardName = null): bool
    {
        if (is_string($permission) && ! $this->isSystemAdmin()) {
            $overrides = $this->permissionOverrideMap();

            if (in_array($permission, AreaPermissions::deniedBy($overrides), true)) {
                return false; // revoke wins over the role
            }
            if (($overrides[$permission] ?? null) === true) {
                return true;  // grant (view permissions only)
            }
        }

        return $this->spatieHasPermissionTo($permission, $guardName);
    }

    /** Role permissions with this user's overrides applied (for the UI). */
    public function effectivePermissionNames()
    {
        $names = $this->getAllPermissions()->pluck('name');
        if ($this->isSystemAdmin()) {
            return $names->values();
        }
        $o = $this->permissionOverrideMap();
        $denied = AreaPermissions::deniedBy($o);

        return $names->reject(fn ($n) => in_array($n, $denied, true))
            ->merge(array_keys(array_filter($o)))->unique()->values();
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function isActive(): bool
    {
        return (bool) ($this->is_active ?? true);
    }
}
