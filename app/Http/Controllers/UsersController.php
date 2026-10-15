<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateUserRequest;
use App\Http\Requests\StoreUserRequest;
use App\Support\AreaPermissions;
use App\Http\Requests\UpdateUserPermissionsRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\DB;

class UsersController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user()?->can('users.manage'), 403);
 
        $users = User::with(['roles.permissions', 'permissionOverrides'])
            ->get()
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'roles' => $u->roles->pluck('name')->toArray(),
                'is_active' => (bool) $u->is_active,
                'last_login_at' => $u->last_login_at?->toIso8601String(),
                'is_admin' => $u->isSystemAdmin(),
                'areas' => $this->areaState($u),
            ]);
 
        return Inertia::render('Settings/Admin/Users/Index', [
            'users'          => $users,
            'availableRoles' => Role::orderBy('name')->pluck('name'),
            'authId'         => $request->user()->id,
            'can' => [
                'create' => true,
                'edit'   => true,
            ],
            'permissionAreas' => collect(AreaPermissions::areas())
                ->map(fn ($a, $key) => ['key' => $key, 'label' => $a['label'], 'group' => $a['group'], 'description' => $a['description']])
                ->values(),
        ]);
    }

    public function create(Request $request): Response
    {
        abort_unless($request->user()?->can('users.manage'), 403);

        return Inertia::render('Settings/Admin/Users/Create', [
            'roles' => Role::orderBy('name')->pluck('name'),
        ]);
    }

    public function store(StoreUserRequest $request): RedirectResponse
    {
        $user = User::create([
            'name' => $request->validated('name'),
            'email' => $request->validated('email'),
            'password' => Hash::make($request->validated('password')),
            'is_active' => true,
            'email_verified_at' => now(), // admin-created, skip email verification
        ]);

        $user->syncRoles([$request->validated('role')]);

        return redirect()->route('users.index')->with('success', "Account created for {$user->name}.");
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        abort_unless($request->user()?->can('users.manage'), 403);

        $user->update([
            'name' => $request->validated('name'),
            'email' => $request->validated('email'),
        ]);

        $user->syncRoles([$request->validated('role')]);

        return back()->with('success', "{$user->name}'s profile was updated.");
    }

    public function toggleActive(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()?->can('users.manage'), 403);
 
        // Prevent self-deactivation
        if ($user->id === $request->user()->id) {
            return back()->with('error', 'You cannot deactivate your own account.');
        }
 
        $user->update(['is_active' => ! $user->is_active]);
 
        $status = $user->is_active ? 'reactivated' : 'deactivated';
 
        return back()->with('success', "{$user->name}'s account has been {$status}.");
    }
 
    public function sendPasswordReset(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()?->can('users.manage'), 403);
 
        Password::sendResetLink(['email' => $user->email]);
 
        return back()->with('success', "Password reset email sent to {$user->email}.");
    }

    private function areaState(User $u): array
{
    $overrides = $u->permissionOverrideMap();
    return collect(AreaPermissions::areas())->map(function ($a) use ($u, $overrides) {
        $roleDefault = $u->roleGrantsPermission($a['view']);
        $allowed = $u->isSystemAdmin() ? true : ($overrides[$a['view']] ?? $roleDefault);
        return [
            'allowed' => $allowed,
            'role_default' => $roleDefault,
            'source' => $allowed === $roleDefault ? 'role' : 'custom',
        ];
    })->all();
}

    public function updatePermissions(UpdateUserPermissionsRequest $request, User $user): RedirectResponse
    {
        $user->load('roles.permissions');
        abort_if($user->isSystemAdmin(), 403, 'System Admin access cannot be restricted.');

        $areas = $request->validated('areas');

        DB::transaction(function () use ($user, $areas) {
            foreach (AreaPermissions::areas() as $key => $area) {
                $allowed = (bool) $areas[$key];
                $perm = $area['view'];

                if ($allowed === $user->roleGrantsPermission($perm)) {
                    $user->permissionOverrides()->where('permission', $perm)->delete();
                } else {
                    $user->permissionOverrides()->updateOrCreate(
                        ['permission' => $perm],
                        ['allowed' => $allowed],
                    );
                }
            }
        });

        $user->forgetPermissionOverrides();

        return back()->with('success', "{$user->name}'s access was updated.");
    }
}