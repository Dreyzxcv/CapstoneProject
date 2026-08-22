<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'roles' => $user->getRoleNames(),
                    'permissions' => $user->getAllPermissions()->pluck('name'),
                ] : null,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
            'notifications' => [
                'unreadCount' => fn () => $user
                    ? \App\Models\Notification::where('user_id', $user->id)->whereNull('read_at')->count()
                    : 0,
                'items' => fn () => $user
                    ? \App\Models\Notification::where('user_id', $user->id)
                        ->whereNull('read_at')
                        ->latest()
                        ->limit(10)
                        ->get(['id', 'asset_id', 'link', 'title', 'message', 'created_at'])
                    : [],
                'unreadAssetIds' => fn () => $user
                    ? \App\Models\Notification::where('user_id', $user->id)
                        ->whereNull('read_at')
                        ->whereNotNull('asset_id')
                        ->pluck('asset_id')
                        ->unique()
                        ->values()
                    : [],
            ],
        ];
    }
}
