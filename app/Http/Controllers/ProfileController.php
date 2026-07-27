<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use App\Models\AuditLog;
use App\Services\UserAgentParser;
use Carbon\Carbon;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Display the user's profile form.
     */
    public function edit(Request $request): Response
    {
        $user = $request->user();

        $recentActivity = AuditLog::query()
            ->where('user_id', $user->id)
            ->latest('created_at')
            ->limit(8)
            ->get(['id', 'action', 'model_type', 'model_id', 'created_at']);

        $currentSessionId = $request->session()->getId();
        $sessions = collect();

        // Session listing only makes sense on the "database" session driver,
        // since that's the only one that persists rows we can query per-user.
        if (config('session.driver') === 'database') {
            $sessions = DB::table(config('session.table', 'sessions'))
                ->where('user_id', $user->id)
                ->orderByDesc('last_activity')
                ->get(['id', 'ip_address', 'user_agent', 'last_activity'])
                ->map(function ($session) use ($currentSessionId) {
                    $agent = UserAgentParser::parse($session->user_agent);

                    return [
                        'id' => $session->id,
                        'ip_address' => $session->ip_address,
                        'browser' => $agent['browser'],
                        'platform' => $agent['platform'],
                        'last_active' => Carbon::createFromTimestamp($session->last_activity)->toIso8601String(),
                        'is_current_device' => $session->id === $currentSessionId,
                    ];
                })
                ->values();
        }

        return Inertia::render('Profile/Edit', [
            'mustVerifyEmail' => $user instanceof MustVerifyEmail,
            'status' => session('status'),
            'lastLoginAt' => $user->last_login_at?->toIso8601String(),
            'recentActivity' => $recentActivity,
            'sessions' => $sessions,
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->fill($request->validated());

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        return Redirect::route('profile.edit');
    }

    /**
     * Log the user out of every browser session except the current one.
     */
    public function destroyOtherSessions(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        if (config('session.driver') === 'database') {
            DB::table(config('session.table', 'sessions'))
                ->where('user_id', $request->user()->id)
                ->where('id', '!=', $request->session()->getId())
                ->delete();
        }

        return back()->with('success', 'Logged out of all other browser sessions.');
    }

    /**
     * Delete the user's account.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Redirect::to('/');
    }
}