<?php

use App\Http\Controllers\AssetController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DisposalController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\JevController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\QrScanController;
use App\Http\Controllers\ReportController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return auth()->check()
        ? redirect()->route('dashboard')
        : redirect()->route('login');
});

Route::middleware(['auth', 'verified', 'active'])->group(function () {
    Route::get('/dashboard', DashboardController::class)->name('dashboard');

    Route::resource('assets', AssetController::class)->only(['index', 'create', 'store', 'show']);
    Route::post('/assets/{asset}/sign-receipt', [AssetController::class, 'signReceipt'])->name('assets.sign-receipt');
    Route::post('/assets/{asset}/mark-stored', [AssetController::class, 'markStored'])->name('assets.mark-stored');

    Route::post('/assets/{asset}/jev', [JevController::class, 'store'])->name('assets.jev.store');
    Route::post('/assets/{asset}/jev/upload', [JevController::class, 'upload'])->name('assets.jev.upload');

    Route::get('/incidents/create', [\App\Http\Controllers\IncidentController::class, 'create'])->name('incidents.create');
    Route::post('/incidents', [\App\Http\Controllers\IncidentController::class, 'store'])->name('incidents.store');

    Route::get('/disposals', [DisposalController::class, 'index'])->name('disposals.index');
    Route::get('/assets/{asset}/disposals/create', [DisposalController::class, 'create'])->name('disposals.create');
    Route::post('/assets/{asset}/disposals', [DisposalController::class, 'store'])->name('disposals.store');
    Route::post('/assets/{asset}/resolve-trial', [AssetController::class, 'resolveTrial'])->name('assets.resolve-trial');
    Route::post('/disposals/{disposal}/release-donation', [DisposalController::class, 'releaseDonation'])->name('disposals.release-donation');

    Route::get('/scan', [QrScanController::class, 'index'])->name('scan.index');
    Route::post('/scan', [QrScanController::class, 'store'])->name('scan.store');

    // Moved inside the protected group (with 'active' middleware) so a
    // deactivated user's still-valid session can no longer resolve QR
    // codes and view asset records. Previously this route sat outside
    // the group and only checked auth()->check() manually, which let
    // deactivated accounts bypass EnsureUserIsActive entirely.
    Route::get('/scan/{token}', [QrScanController::class, 'resolve'])
        ->middleware('signed')
        ->name('scan.resolve');

    Route::get('/users', [\App\Http\Controllers\UsersController::class, 'index'])->name('users.index');
    Route::get('/users/create', [\App\Http\Controllers\UsersController::class, 'create'])->name('users.create');
    Route::post('/users', [\App\Http\Controllers\UsersController::class, 'store'])->name('users.store');
    Route::put('/users/{user}', [\App\Http\Controllers\UsersController::class, 'update'])->name('users.update');

    Route::get('/reports', [ReportController::class, 'index'])->name('reports.index');
    Route::get('/reports/inventory.csv', [ReportController::class, 'inventory'])->name('reports.inventory');
    Route::get('/reports/compliance.pdf', [ReportController::class, 'compliance'])->name('reports.compliance');
    Route::get('/audit-logs', [ReportController::class, 'auditLogs'])->name('audit-logs.index');

    Route::get('/documents/{path}', [DocumentController::class, 'download'])
        ->where('path', '[A-Za-z0-9+/=]+')
        ->name('documents.download');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';