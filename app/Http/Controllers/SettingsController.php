<?php

namespace App\Http\Controllers;

use App\Http\Controllers\BackupController;
use App\Models\BackupSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{

    public function index(Request $request): RedirectResponse
    {
        $user = $request->user();

        if ($user?->can('backup.run')) {
            return redirect()->route('settings.backup');
        }

        if ($user?->can('users.manage')) {
            return redirect()->route('users.index');
        }

        if ($user?->can('market_prices.manage')) {
            return redirect()->route('market-prices.index');
        }

        return redirect()->route('dashboard');
    }

    public function backup(Request $request): Response
    {
        $this->authorize('backup.run');

        $settings = BackupSetting::current();

        return Inertia::render('Settings/Backup', [
            'backupStatus'   => BackupController::latestStatus(),
            'canRunBackup'   => true,
            'backupSettings' => [
                'auto_enabled'   => $settings->auto_enabled,
                'frequency'      => $settings->frequency,
                'time'           => $settings->time,
                'day_of_week'    => $settings->day_of_week,
                'retention_days' => $settings->retention_days,
                'next_run'       => $settings->nextRunAt()?->toIso8601String(),
            ],
        ]);
    }
}