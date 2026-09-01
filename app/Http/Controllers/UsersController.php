<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateUserRequest;
use App\Http\Requests\StoreUserRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;
use Illuminate\Support\Facades\Password;

class UsersController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user()?->can('users.manage'), 403);
 
        $users = User::with('roles')
            ->get()
            ->map(fn ($u) => [
                'id'           => $u->id,
                'name'         => $u->name,
                'email'        => $u->email,
                'roles'        => $u->roles->pluck('name')->toArray(),
                'is_active'    => (bool) $u->is_active,
                'last_login_at'=> $u->last_login_at?->toIso8601String(),
            ]);
 
        return Inertia::render('Users/Index', [
            'users'          => $users,
            'availableRoles' => Role::orderBy('name')->pluck('name'),
            'authId'         => $request->user()->id,
            'can' => [
                'create' => true,
                'edit'   => true,
            ],
        ]);
    }

    public function create(Request $request): Response
    {
        abort_unless($request->user()?->can('users.manage'), 403);

        return Inertia::render('Users/Create', [
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
}