<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Only trust proxy IPs explicitly listed in TRUSTED_PROXIES (comma
        // separated, e.g. "10.0.0.1,10.0.0.2"). Previously this trusted
        // '*' (every client), which lets any device on the local network
        // spoof X-Forwarded-For / X-Forwarded-Proto — affecting both the
        // HTTPS-scheme detection in AppServiceProvider and the IP address
        // recorded by AuditLogService. Leave TRUSTED_PROXIES unset to
        // trust no proxies at all, which is the correct default for a
        // single-server local-network deployment with no reverse proxy.
        $trustedProxies = array_filter(explode(',', (string) env('TRUSTED_PROXIES', '')));

        if ($trustedProxies !== []) {
            $middleware->trustProxies(at: $trustedProxies);
        }

        $middleware->web(append: [
            \App\Http\Middleware\HandleInertiaRequests::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->alias([
            'active' => \App\Http\Middleware\EnsureUserIsActive::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );

        $exceptions->respond(function (Response $response, \Throwable $exception, Request $request) {
            if ($request->is('api/*')) {
                return $response;
            }

            if ($response->getStatusCode() === 419) {
                return back()->with([
                    'error' => 'Your session expired. Please try again.',
                ]);
            }

            if (! config('app.debug') && in_array($response->getStatusCode(), [404, 403, 500, 503], true)) {
                return Inertia::render('Errors/Error', [
                    'status' => $response->getStatusCode(),
                ])
                    ->toResponse($request)
                    ->setStatusCode($response->getStatusCode());
            }

            return $response;
        });
    })->create();