<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        RateLimiter::for('qr-scan', function (Request $request) {
            return Limit::perMinute(30)->by(
                $request->user()?->getAuthIdentifier() ?? $request->ip()
            );
        });

        RateLimiter::for('report-export', function (Request $request) {
            return Limit::perMinute(10)->by(
                $request->user()?->getAuthIdentifier() ?? $request->ip()
            );
        });

        RateLimiter::for('file-upload', function (Request $request) {
            return Limit::perMinute(20)->by(
                $request->user()?->getAuthIdentifier() ?? $request->ip()
            );
        });

        if (str_starts_with(config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }

        Vite::prefetch(concurrency: 3);

        Password::defaults(function () {
            return Password::min(10)
                ->letters()
                ->mixedCase()
                ->numbers()
                ->symbols();
        });

        foreach ([
            config('dompdf.options.temp_dir'),
            config('dompdf.options.font_dir'),
            config('dompdf.options.font_cache'),
        ] as $dir) {
            if ($dir && ! File::isDirectory($dir)) {
                File::makeDirectory($dir, 0775, true, true);
            }
        }
    }
}
