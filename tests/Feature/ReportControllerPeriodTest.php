<?php

namespace Tests\Feature\Reports;

use App\Enums\AssetStatus;
use App\Enums\AssetType;
use App\Models\Asset;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Tests for the shared chart period filter on the Reports index page.
 *
 * Coverage:
 *  - Default period (6m) is applied when none is supplied.
 *  - Each valid period (3m, 6m, 12m, all) filters byType, byMunicipality,
 *    and trends consistently.
 *  - An invalid period value is silently coerced to the default (6m).
 *  - The period and periodLabel props are present and correct in every response.
 *  - The map's month/year filters remain independent of the chart period.
 *  - "All time" still returns a finite, readable trend (capped at 24 months).
 */
class ReportControllerPeriodTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        // Create a user who can view assets (adjust the policy/permission to match
        // however your app grants viewAny on Asset).
        $this->user = User::factory()->create();
        $this->user->givePermissionTo('assets.view'); // adjust to your Gate/Spatie setup
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    /** Create an asset with a specific created_at date and type. */
    private function makeAsset(Carbon $createdAt, AssetType $type = AssetType::Log): Asset
    {
        return Asset::factory()->create([
            'type'       => $type,
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);
    }

    private function getPage(array $params = []): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($this->user)
            ->get(route('reports.index', $params));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Period validation
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function it_defaults_to_six_month_period_when_no_period_is_supplied(): void
    {
        $response = $this->getPage();

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Reports/Index')
            ->where('period', '6m')
            ->where('periodLabel', 'Last 6 months')
        );
    }

    /** @test */
    public function it_accepts_all_valid_period_values(): void
    {
        $expected = [
            '3m'  => 'Last 3 months',
            '6m'  => 'Last 6 months',
            '12m' => 'Last 12 months',
            'all' => 'All time',
        ];

        foreach ($expected as $key => $label) {
            $response = $this->getPage(['period' => $key]);

            $response->assertOk();
            $response->assertInertia(fn ($page) => $page
                ->where('period', $key)
                ->where('periodLabel', $label)
            );
        }
    }

    /** @test */
    public function it_coerces_an_invalid_period_to_the_default(): void
    {
        foreach (['week', 'ytd', '', 'null', '0', '99m'] as $bad) {
            $response = $this->getPage(['period' => $bad]);

            $response->assertOk();
            $response->assertInertia(fn ($page) => $page
                ->where('period', '6m')
                ->where('periodLabel', 'Last 6 months')
            );
        }
    }

    /** @test */
    public function period_options_prop_contains_all_four_choices(): void
    {
        $response = $this->getPage();

        $response->assertInertia(fn ($page) => $page
            ->has('periodOptions', 4)
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Data filtering — byType
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function by_type_includes_only_assets_within_three_month_period(): void
    {
        $inside  = now()->subMonths(2);
        $outside = now()->subMonths(4);

        $this->makeAsset($inside,  AssetType::Log);
        $this->makeAsset($outside, AssetType::Equipment); // must be excluded

        $response = $this->getPage(['period' => '3m']);

        $response->assertInertia(fn ($page) => $page
            ->where('byType', fn (array $types) =>
                collect($types)->firstWhere('type', AssetType::Log->value)?->count === 1
                && collect($types)->firstWhere('type', AssetType::Equipment->value) === null
            )
        );
    }

    /** @test */
    public function by_type_includes_only_assets_within_six_month_period(): void
    {
        $inside  = now()->subMonths(5);
        $outside = now()->subMonths(7);

        $this->makeAsset($inside,  AssetType::Log);
        $this->makeAsset($outside, AssetType::Vehicle);

        $response = $this->getPage(['period' => '6m']);

        $response->assertInertia(fn ($page) => $page
            ->where('byType', fn (array $types) =>
                collect($types)->firstWhere('type', AssetType::Log->value)?->count === 1
                && collect($types)->firstWhere('type', AssetType::Vehicle->value) === null
            )
        );
    }

    /** @test */
    public function by_type_includes_only_assets_within_twelve_month_period(): void
    {
        $inside  = now()->subMonths(11);
        $outside = now()->subMonths(13);

        $this->makeAsset($inside,  AssetType::Equipment);
        $this->makeAsset($outside, AssetType::Log);

        $response = $this->getPage(['period' => '12m']);

        $response->assertInertia(fn ($page) => $page
            ->where('byType', fn (array $types) =>
                collect($types)->firstWhere('type', AssetType::Equipment->value)?->count === 1
                && collect($types)->firstWhere('type', AssetType::Log->value) === null
            )
        );
    }

    /** @test */
    public function all_time_period_includes_assets_from_any_date(): void
    {
        $this->makeAsset(now()->subYears(3), AssetType::Log);
        $this->makeAsset(now()->subMonths(1), AssetType::Equipment);

        $response = $this->getPage(['period' => 'all']);

        $response->assertInertia(fn ($page) => $page
            ->where('byType', fn (array $types) =>
                collect($types)->firstWhere('type', AssetType::Log->value)?->count >= 1
                && collect($types)->firstWhere('type', AssetType::Equipment->value)?->count >= 1
            )
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Data filtering — byMunicipality
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function by_municipality_uses_the_same_period_as_by_type(): void
    {
        $inside  = now()->subMonths(2);
        $outside = now()->subMonths(8);

        Asset::factory()->create([
            'municipality_of_origin' => 'Virac',
            'created_at' => $inside,
        ]);
        Asset::factory()->create([
            'municipality_of_origin' => 'Bato',
            'created_at' => $outside, // must be excluded for 3m
        ]);

        $response = $this->getPage(['period' => '3m']);

        $response->assertInertia(fn ($page) => $page
            ->where('byMunicipality', fn (array $rows) =>
                collect($rows)->firstWhere('municipality_of_origin', 'Virac') !== null
                && collect($rows)->firstWhere('municipality_of_origin', 'Bato') === null
            )
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Data filtering — trends
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function trends_bucket_count_matches_the_selected_period(): void
    {
        $response3m  = $this->getPage(['period' => '3m']);
        $response6m  = $this->getPage(['period' => '6m']);
        $response12m = $this->getPage(['period' => '12m']);

        $count = fn ($response) => count(
            $response->viewData('page')['props']['trends'] ?? []
        );

        // 3 months → 3 buckets (start-of-month for each of the last 3 months plus current)
        $this->assertEquals(4, $count($response3m));   // subMonths(3) + current = 4 buckets
        $this->assertEquals(7, $count($response6m));   // subMonths(6) + current = 7 buckets
        $this->assertEquals(13, $count($response12m)); // subMonths(12) + current = 13 buckets
    }

    /** @test */
    public function all_time_trends_are_capped_at_twenty_four_months(): void
    {
        // Plant an asset 3 years ago — it should NOT create more than 25 buckets.
        $this->makeAsset(now()->subYears(3));

        $response = $this->getPage(['period' => 'all']);

        $response->assertInertia(fn ($page) => $page
            ->where('trends', fn (array $trends) => count($trends) <= 25)
        );
    }

    /** @test */
    public function trends_only_count_assets_within_the_period(): void
    {
        Carbon::setTestNow(now());

        $this->makeAsset(now()->subMonths(2)); // inside 3m, 6m, 12m, all
        $this->makeAsset(now()->subMonths(4)); // inside 6m, 12m, all; outside 3m

        $response3m = $this->getPage(['period' => '3m']);
        $response6m = $this->getPage(['period' => '6m']);

        $totalFor = fn ($response) => collect(
            $response->viewData('page')['props']['trends'] ?? []
        )->sum('total');

        $this->assertEquals(1, $totalFor($response3m));
        $this->assertEquals(2, $totalFor($response6m));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Map filter independence
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function map_filters_are_independent_of_chart_period(): void
    {
        $response = $this->getPage([
            'period'    => '3m',
            'map_month' => '5',    // June (0-indexed)
            'map_year'  => '2024',
        ]);

        $response->assertOk();

        $response->assertInertia(fn ($page) => $page
            ->where('period', '3m')
            ->where('mapFilters.month', '5')
            ->where('mapFilters.year', '2024')
        );
    }

    /** @test */
    public function map_filters_default_to_all_when_not_supplied(): void
    {
        $response = $this->getPage(['period' => '12m']);

        $response->assertInertia(fn ($page) => $page
            ->where('mapFilters.month', 'all')
            ->where('mapFilters.year', 'all')
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Summary cards are never period-filtered
    // ──────────────────────────────────────────────────────────────────────────

    /** @test */
    public function summary_counts_are_not_affected_by_chart_period(): void
    {
        // An old asset that is well outside any scoped period
        $this->makeAsset(now()->subYears(5));

        $response3m  = $this->getPage(['period' => '3m']);
        $responseAll = $this->getPage(['period' => 'all']);

        $total3m  = $response3m->viewData('page')['props']['summary']['total'];
        $totalAll = $responseAll->viewData('page')['props']['summary']['total'];

        // Both must equal the full asset count
        $this->assertEquals(Asset::count(), $total3m);
        $this->assertEquals(Asset::count(), $totalAll);
        $this->assertEquals($total3m, $totalAll);
    }
}