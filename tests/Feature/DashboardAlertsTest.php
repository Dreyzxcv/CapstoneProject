<?php

namespace Tests\Feature;

use App\Enums\AssetMode;
use App\Enums\AssetStatus;
use App\Enums\AssetType;
use App\Enums\Municipality;
use App\Models\Asset;
use App\Models\AssetCaseStatusHistory;
use App\Models\User;
use App\Services\AssetAlertService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;
use Illuminate\Support\Collection;

class DashboardAlertsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function user(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function asset(User $creator, AssetStatus $status, array $overrides = [], int $createdDaysAgo = 0): Asset
    {
        $asset = Asset::create(array_merge([
            'asset_code'             => 'T-'.Str::upper(Str::random(6)),
            'type'                   => AssetType::Log->value,
            'current_status'         => $status->value,
            'mode'                   => AssetMode::cases()[0]->value,
            'municipality_of_origin' => Municipality::cases()[0]->value,
            'location_apprehended'   => 'Test Location',
            'apprehending_agency'    => 'Test Agency',
            'qr_code_token'          => Str::random(32),
            'quantity'               => 1,
            'disposed_quantity'      => 0,
            'created_by'             => $creator->id,
        ], $overrides));

        if ($createdDaysAgo > 0) {
            $asset->forceFill(['created_at' => now()->subDays($createdDaysAgo)])->save();
        }

        return $asset;
    }

    private function enterStatus(Asset $asset, AssetStatus $status, int $daysAgo, User $by): void
    {
        AssetCaseStatusHistory::create([
            'asset_id'   => $asset->id,
            'status'     => $status->value,
            'event_type' => 'status_change',
            'changed_by' => $by->id,
            'changed_at' => now()->subDays($daysAgo),
        ]);
    }

    private function alertsFor(User $user, ?int $limit = AssetAlertService::DEFAULT_LIMIT): Collection
    {
        return app(AssetAlertService::class)->forUser($user, $limit)['alerts'];
    }

    public function test_custody_review_age_uses_status_entry_date_not_creation_date(): void
    {
        $custodian = $this->user('Property Custodian');

        $fresh = $this->asset($custodian, AssetStatus::PendingCustodyReview, ['asset_code' => 'FRESH-1'], 40);
        $this->enterStatus($fresh, AssetStatus::PendingCustodyReview, 2, $custodian);

        $stale = $this->asset($custodian, AssetStatus::PendingCustodyReview, ['asset_code' => 'STALE-1'], 40);
        $this->enterStatus($stale, AssetStatus::PendingCustodyReview, 9, $custodian);

        $alerts = $this->alertsFor($custodian);

        $this->assertCount(1, $alerts);
        $this->assertSame('STALE-1', $alerts[0]['asset_code']);
        $this->assertSame(9, $alerts[0]['waiting_days']);
        $this->assertStringContainsString('9 days', $alerts[0]['message']);
    }

    public function test_custody_review_falls_back_to_creation_date_without_history(): void
    {
        $custodian = $this->user('Property Custodian');
        $this->asset($custodian, AssetStatus::PendingCustodyReview, ['asset_code' => 'NOHIST-1'], 10);

        $alerts = $this->alertsFor($custodian);

        $this->assertCount(1, $alerts);
        $this->assertSame(10, $alerts[0]['waiting_days']);
    }

    public function test_appeal_alerts_show_deadline_and_overdue_comes_first(): void
    {
        $admin = $this->user('System Admin');

        $soon = $this->asset($admin, AssetStatus::ClearedForAccounting, [
            'asset_code'      => 'VEH-SOON',
            'type'            => AssetType::Vehicle->value,
            'appeal_deadline' => now()->addDays(2),
        ]);
        $late = $this->asset($admin, AssetStatus::ForDisposal, [
            'asset_code'      => 'VEH-LATE',
            'type'            => AssetType::Vehicle->value,
            'appeal_deadline' => now()->subDays(4),
        ]);

        $alerts = $this->alertsFor($admin);

        $this->assertSame(['VEH-LATE', 'VEH-SOON'], $alerts->pluck('asset_code')->all());
        $this->assertSame('critical', $alerts[0]['severity']);
        $this->assertSame(4, $alerts[0]['waiting_days']);
        $this->assertSame($late->appeal_deadline->toDateString(), $alerts[0]['deadline']);
        $this->assertStringContainsString($late->appeal_deadline->format('M d, Y'), $alerts[0]['message']);
        $this->assertSame('Process disposal', $alerts[0]['action']['label']);
        $this->assertSame(route('disposals.create', $late->id, false), $alerts[0]['action']['href']);
        $this->assertSame('Review asset', $alerts[1]['action']['label']);
        $this->assertSame($soon->appeal_deadline->toDateString(), $alerts[1]['deadline']);
    }

    public function test_alerts_are_ordered_by_severity_then_oldest_first(): void
    {
        $admin = $this->user('System Admin');

        $newer = $this->asset($admin, AssetStatus::PendingCustodyReview, ['asset_code' => 'REV-NEW']);
        $this->enterStatus($newer, AssetStatus::PendingCustodyReview, 8, $admin);
        $older = $this->asset($admin, AssetStatus::PendingCustodyReview, ['asset_code' => 'REV-OLD']);
        $this->enterStatus($older, AssetStatus::PendingCustodyReview, 20, $admin);

        $decay = $this->asset($admin, AssetStatus::ForDisposal, ['asset_code' => 'LOG-DECAY']);
        $this->enterStatus($decay, AssetStatus::ForDisposal, 31, $admin);

        $this->assertSame(
            ['LOG-DECAY', 'REV-OLD', 'REV-NEW'],
            $this->alertsFor($admin)->pluck('asset_code')->all(),
        );
    }

    public function test_custodian_gets_review_action_but_mes_officer_does_not_see_it(): void
    {
        $custodian = $this->user('Property Custodian');
        $mes       = $this->user('MES Officer');

        $asset = $this->asset($custodian, AssetStatus::PendingCustodyReview);
        $this->enterStatus($asset, AssetStatus::PendingCustodyReview, 9, $custodian);

        $forCustodian = $this->alertsFor($custodian);
        $this->assertCount(1, $forCustodian);
        $this->assertTrue($forCustodian[0]['actionable']);
        $this->assertSame('Review documents', $forCustodian[0]['action']['label']);
        $this->assertSame(route('assets.show', $asset->id, false), $forCustodian[0]['action']['href']);

        $this->assertCount(0, $this->alertsFor($mes));
    }

    public function test_oversight_roles_see_alerts_without_action_when_they_cannot_act(): void
    {
        $management = $this->user('PENRO Management');
        $admin      = $this->user('System Admin');

        $asset = $this->asset($admin, AssetStatus::PendingCustodyReview);
        $this->enterStatus($asset, AssetStatus::PendingCustodyReview, 9, $admin);

        $forManagement = $this->alertsFor($management);
        $this->assertCount(1, $forManagement);
        $this->assertFalse($forManagement[0]['actionable']);
        $this->assertSame('View asset', $forManagement[0]['action']['label']);

        $forAdmin = $this->alertsFor($admin);
        $this->assertTrue($forAdmin[0]['actionable']);
        $this->assertSame('Review documents', $forAdmin[0]['action']['label']);
    }

    public function test_pending_upload_alert_goes_to_mes_and_skips_assets_that_already_passed_review(): void
    {
        $mes = $this->user('MES Officer');

        $waiting = $this->asset($mes, AssetStatus::Stored, ['asset_code' => 'WAIT-DOCS']);
        $this->enterStatus($waiting, AssetStatus::Stored, 10, $mes);

        $tagged = $this->asset($mes, AssetStatus::Stored, ['asset_code' => 'ALREADY-TAGGED']);
        $this->enterStatus($tagged, AssetStatus::ReceiptSigned, 20, $mes);
        $this->enterStatus($tagged, AssetStatus::Stored, 10, $mes);

        $alerts = $this->alertsFor($mes);

        $this->assertSame(['WAIT-DOCS'], $alerts->pluck('asset_code')->all());
        $this->assertSame('Upload documents', $alerts[0]['action']['label']);
        $this->assertSame(10, $alerts[0]['waiting_days']);
    }

    public function test_verified_assets_awaiting_tagging_alert_goes_to_custodian(): void
    {
        $custodian = $this->user('Property Custodian');
        $mes       = $this->user('MES Officer');

        $asset = $this->asset($custodian, AssetStatus::ReceiptSigned);
        $this->enterStatus($asset, AssetStatus::ReceiptSigned, 8, $custodian);

        $alerts = $this->alertsFor($custodian);
        $this->assertCount(1, $alerts);
        $this->assertSame('Tag asset', $alerts[0]['action']['label']);
        $this->assertCount(0, $this->alertsFor($mes));
    }

    public function test_alerts_under_threshold_are_not_raised(): void
    {
        $admin = $this->user('System Admin');

        $review = $this->asset($admin, AssetStatus::PendingCustodyReview);
        $this->enterStatus($review, AssetStatus::PendingCustodyReview, 6, $admin);
        $decay = $this->asset($admin, AssetStatus::ForDisposal);
        $this->enterStatus($decay, AssetStatus::ForDisposal, 29, $admin);

        $this->assertCount(0, $this->alertsFor($admin));
    }

    public function test_dashboard_limits_alerts_and_reports_total_with_a_way_to_see_all(): void
    {
        $admin = $this->user('System Admin');

        for ($i = 0; $i < 17; $i++) {
            $this->asset($admin, AssetStatus::ForDisposal, [
                'type'            => AssetType::Vehicle->value,
                'appeal_deadline' => now()->subDays($i + 1),
            ]);
        }

        $this->actingAs($admin)->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Index')
                ->has('alerts', 15)
                ->where('alertSummary.total', 17)
                ->where('alertSummary.shown', 15)
                ->where('alertSummary.showingAll', false));

        $this->actingAs($admin)->get(route('dashboard', ['all_alerts' => 1]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('alerts', 17)
                ->where('alertSummary.showingAll', true));
    }

    public function test_dashboard_empty_state_still_returns_no_alerts(): void
    {
        $admin = $this->user('System Admin');

        $this->actingAs($admin)->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('alerts', 0)
                ->where('alertSummary.total', 0));
    }
}