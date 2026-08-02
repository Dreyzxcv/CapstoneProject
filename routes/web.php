<?php

use App\Http\Controllers\AssetController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DisposalController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\JevController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\QrScanController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\MarketPriceController;
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
    Route::post('/assets/{asset}/mark-stored', [AssetController::class, 'markStored'])->name('assets.mark-stored');

    Route::post('/assets/{asset}/jev', [JevController::class, 'store'])->name('assets.jev.store');
    Route::post('/assets/{asset}/jev/upload', [JevController::class, 'upload'])->name('assets.jev.upload');

    Route::get('/incidents/create', [\App\Http\Controllers\IncidentController::class, 'create'])->name('incidents.create');
    Route::post('/incidents', [\App\Http\Controllers\IncidentController::class, 'store'])->name('incidents.store');

    Route::get('/disposals', [DisposalController::class, 'index'])->name('disposals.index');
    Route::get('/disposals/donate', [DisposalController::class, 'createBatchDonation'])->name('disposals.donate.create');
    Route::post('/disposals/donate', [DisposalController::class, 'storeBatchDonation'])->name('disposals.donate.store');
    Route::get('/assets/{asset}/disposals/create', [DisposalController::class, 'create'])->name('disposals.create');
    Route::post('/assets/{asset}/disposals', [DisposalController::class, 'store'])->name('disposals.store');
    Route::post('/assets/{asset}/resolve-trial', [AssetController::class, 'resolveTrial'])->name('assets.resolve-trial');
    Route::post('/assets/{asset}/documents', [DocumentController::class, 'store'])->name('assets.documents.store');
    Route::post('/assets/{asset}/required-documents', [DocumentController::class, 'storeRequired'])->name('assets.required-documents.store');
    Route::post('/documents/{document}/verify', [DocumentController::class, 'verify'])->name('documents.verify');
    Route::post('/disposals/{disposal}/release-donation', [DisposalController::class, 'releaseDonation'])->name('disposals.release-donation');
    Route::post('/disposals/{disposal}/jev-out', [DisposalController::class, 'issueJevOut'])->name('disposals.jev-out.store');

    Route::get('/scan', [QrScanController::class, 'index'])->name('scan.index');
    Route::post('/scan', [QrScanController::class, 'store'])->name('scan.store');

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

    Route::get('/settings/market-prices', [MarketPriceController::class, 'index'])->name('market-prices.index');
    Route::post('/settings/market-prices', [MarketPriceController::class, 'store'])->name('market-prices.store');
    Route::delete('/settings/market-prices/{marketPrice}', [MarketPriceController::class, 'destroy'])->name('market-prices.destroy');

    Route::get('/documents/{path}', [DocumentController::class, 'download'])
        ->where('path', '[A-Za-z0-9+/=]+')
        ->name('documents.download');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile/other-browser-sessions', [ProfileController::class, 'destroyOtherSessions'])->name('profile.sessions.destroy-others');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::post('/notifications/{notification}/read', [\App\Http\Controllers\NotificationController::class, 'markRead'])->name('notifications.read');
    Route::post('/notifications/read-all', [\App\Http\Controllers\NotificationController::class, 'markAllRead'])->name('notifications.read-all');
});

require __DIR__.'/auth.php';