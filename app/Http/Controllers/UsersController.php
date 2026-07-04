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

class UsersController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user()?->can('users.manage'), 403);

        $users = User::with('roles')
            ->get()
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'roles' => $u->roles->pluck('name')->toArray(),
            ]);

        return Inertia::render('Users/Index', [
            'users' => $users,
            'availableRoles' => Role::orderBy('name')->pluck('name'),
            'can' => [
                'create' => true,
                'edit' => true,
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
}