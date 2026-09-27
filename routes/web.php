<?php

use App\Http\Controllers\AssetController;
use App\Http\Controllers\AssetPieceController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DisposalController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\IncidentController;
use App\Http\Controllers\JevController;
use App\Http\Controllers\MarketPriceController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\QrScanController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\UsersController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return auth()->check()
        ? redirect()->route('dashboard')
        : redirect()->route('login');
});

Route::middleware(['auth', 'verified', 'active'])->group(function () {

    // Dashboard 
    Route::get('/dashboard', DashboardController::class)->name('dashboard');

    // Assets 
    Route::resource('assets', AssetController::class)->only(['index', 'create', 'store', 'show']);
    Route::put('/assets/{asset}', [AssetController::class, 'update'])->name('assets.update');
    Route::get('/assets/by-code/{assetCode}', [AssetController::class, 'byCode'])->name('assets.by-code');
    Route::get('/assets/{asset}/stickers.pdf', [AssetController::class, 'printStickers'])
        ->middleware('throttle:report-export')
        ->name('assets.stickers.pdf');
    Route::post('/assets/{asset}/submit-custody-review', [AssetController::class, 'submitForCustodyReview'])->name('assets.submit-for-custody-review');
    Route::post('/assets/{asset}/resolve-custody-review', [AssetController::class, 'resolveCustodyReview'])->name('assets.resolve-custody-review');
    Route::post('/assets/{asset}/mark-stored', [AssetController::class, 'markStored'])->name('assets.mark-stored');
    Route::post('/assets/{asset}/submit-aap-review', [AssetController::class, 'submitAapForReview'])->name('assets.submit-aap-review');
    Route::post('/assets/{asset}/aap-number', [AssetController::class, 'updateAapNumber'])->name('assets.aap-number.update');
    Route::post('/assets/{asset}/stcp-number', [AssetController::class, 'updateStcpNumber'])->name('assets.stcp-number.update');
    Route::post('/assets/{asset}/resolve-trial', [AssetController::class, 'resolveTrial'])->name('assets.resolve-trial');
    Route::post('/assets/{asset}/case-details', [AssetController::class, 'updateCaseDetails'])->name('assets.case-details.update');

    // Asset Pieces 
    Route::put('/asset-pieces/{piece}', [AssetPieceController::class, 'update'])->name('asset-pieces.update');

    // Documents 
    Route::get('/documents/{path}', [DocumentController::class, 'download'])
        ->where('path', '[A-Za-z0-9+/=]+')
        ->name('documents.download');
    Route::post('/assets/{asset}/documents', [DocumentController::class, 'store'])
        ->middleware('throttle:file-upload')
        ->name('assets.documents.store');
    Route::post('/assets/{asset}/required-documents', [DocumentController::class, 'storeRequired'])
        ->middleware('throttle:file-upload')
        ->name('assets.required-documents.store');
    Route::post('/documents/{document}/verify', [DocumentController::class, 'verify'])->name('documents.verify');

    // Incidents 
    Route::get('/incidents/create', [IncidentController::class, 'create'])->name('incidents.create');
    Route::post('/incidents', [IncidentController::class, 'store'])->name('incidents.store');

    // JEV 
    Route::get('/jev', [JevController::class, 'index'])->name('jev.index');
    Route::get('/jev/{asset}', [JevController::class, 'show'])->name('assets.jev.show');
    Route::post('/jev/{asset}', [JevController::class, 'store'])->name('assets.jev.store');

    // Disposals
    Route::get('/disposals', [DisposalController::class, 'index'])->name('disposals.index');
    Route::get('/disposals/donate', [DisposalController::class, 'createBatchDonation'])->name('disposals.donate.create');
    Route::post('/disposals/donate', [DisposalController::class, 'storeBatchDonation'])->name('disposals.donate.store');
    Route::post('/disposals/scan-lookup', [DisposalController::class, 'scanLookup'])
        ->middleware('throttle:qr-scan')
        ->name('disposals.scan-lookup');
    Route::get('/assets/{asset}/disposals/create', [DisposalController::class, 'create'])->name('disposals.create');
    Route::post('/assets/{asset}/disposals', [DisposalController::class, 'store'])->name('disposals.store');
    Route::post('/disposals/{disposal}/release-donation', [DisposalController::class, 'releaseDonation'])->name('disposals.release-donation');
    Route::post('/disposals/{disposal}/jev-out', [DisposalController::class, 'issueJevOut'])->name('disposals.jev-out.store');
    Route::post('/disposals/{disposal}/jev-out/upload', [DisposalController::class, 'uploadJevOut'])
        ->middleware('throttle:file-upload')
        ->name('disposals.jev-out.upload');
    Route::get('/disposals/{disposal}/jev-out/show', [JevController::class, 'showDisposalJev'])->name('disposals.jev-out.show');

    // QR Scan 
    Route::get('/scan', [QrScanController::class, 'index'])->name('scan.index');
    Route::post('/scan', [QrScanController::class, 'store'])
        ->middleware('throttle:qr-scan')
        ->name('scan.store');
    Route::get('/scan/{token}', [QrScanController::class, 'resolve'])
        ->middleware(['signed', 'throttle:qr-scan'])
        ->name('scan.resolve');

    // Reports 
    Route::get('/reports', [ReportController::class, 'index'])->name('reports.index');
    Route::get('/reports/inventory.csv', [ReportController::class, 'inventory'])
        ->middleware('throttle:report-export')
        ->name('reports.inventory');
    Route::get('/reports/compliance.pdf', [ReportController::class, 'compliance'])
        ->middleware('throttle:report-export')
        ->name('reports.compliance');
    Route::get('/reports/attribute-table', [ReportController::class, 'attributeTable'])->name('reports.attribute-table');
    Route::get('/reports/attribute-table/data', [ReportController::class, 'attributeTableData'])->name('reports.attribute-table.data');
    Route::get('/reports/attribute-table/export.csv', [ReportController::class, 'attributeTableExport'])
        ->middleware('throttle:report-export')
        ->name('reports.attribute-table.export');
    Route::get('/reports/donations', [ReportController::class, 'donations'])->name('reports.donations');

    // Audit Logs 
    Route::get('/audit-logs', [ReportController::class, 'auditLogs'])->name('audit-logs.index');
    Route::get('/audit-logs/export.csv', [ReportController::class, 'auditLogsExport'])
        ->middleware('throttle:report-export')
        ->name('audit-logs.export');

    // Settings 
    Route::get('/settings', [SettingsController::class, 'index'])->name('settings.index');
    Route::get('/settings/market-prices', [MarketPriceController::class, 'index'])->name('market-prices.index');
    Route::post('/settings/market-prices', [MarketPriceController::class, 'store'])->name('market-prices.store');
    Route::delete('/settings/market-prices/{marketPrice}', [MarketPriceController::class, 'destroy'])->name('market-prices.destroy');

    // Users 
    Route::get('/users', [UsersController::class, 'index'])->name('users.index');
    Route::get('/users/create', [UsersController::class, 'create'])->name('users.create');
    Route::post('/users', [UsersController::class, 'store'])->name('users.store');
    Route::put('/users/{user}', [UsersController::class, 'update'])->name('users.update');
    Route::patch('/users/{user}/toggle-active', [UsersController::class, 'toggleActive'])->name('users.toggle-active');
    Route::post('/users/{user}/send-reset', [UsersController::class, 'sendPasswordReset'])->name('users.send-reset');

    // Profile 
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile/other-browser-sessions', [ProfileController::class, 'destroyOtherSessions'])->name('profile.sessions.destroy-others');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // Notifications 
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead'])->name('notifications.read');
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead'])->name('notifications.read-all');

    // Misc
    Route::get('/about', fn () => Inertia::render('About'))->name('about');
});

require __DIR__.'/auth.php';
