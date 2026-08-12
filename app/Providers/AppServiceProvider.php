<?php

namespace App\Providers;

use Illuminate\Support\Facades\File;
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