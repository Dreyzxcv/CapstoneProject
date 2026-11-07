<?php

namespace Tests\Feature;

use App\Enums\AssetMode;
use App\Enums\AssetStatus;
use App\Enums\AssetType;
use App\Enums\Municipality;
use App\Models\Asset;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class ReportExportTest extends TestCase
{
    use RefreshDatabase;

    private const REPORT_PERMISSIONS = ['assets.view', 'reports.view', 'reports.export'];

    private function userWith(array $permissions): User
    {
        $user = User::factory()->create();

        foreach ($permissions as $name) {
            Permission::findOrCreate($name, 'web');
            $user->givePermissionTo($name);
        }

        return $user;
    }

    private function systemAdmin(): User
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (self::REPORT_PERMISSIONS as $name) {
            Permission::findOrCreate($name, 'web');
        }

        $role = Role::findOrCreate('System Admin', 'web');
        $role->syncPermissions(self::REPORT_PERMISSIONS);

        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function makeAsset(User $creator, array $overrides = []): Asset
    {
        return Asset::create(array_merge([
            'asset_code'             => 'TEST-'.uniqid(),
            'type'                   => AssetType::cases()[0]->value,
            'current_status'         => AssetStatus::cases()[0]->value,
            'mode'                   => AssetMode::cases()[0]->value,
            'municipality_of_origin' => Municipality::cases()[0]->value,
            'location_apprehended'   => 'Test Location',
            'apprehending_agency'    => 'Test Agency',
            'qr_code_token'          => Str::random(32),
            'quantity'               => 1,
            'created_by'             => $creator->id,
        ], $overrides));
    }

    public static function attributeTableRoutes(): array
    {
        return [
            'full page' => ['reports.attribute-table'],
            'data json' => ['reports.attribute-table.data'],
            'csv export' => ['reports.attribute-table.export'],
        ];
    }

    #[DataProvider('attributeTableRoutes')]
    public function test_system_admin_can_access_attribute_table_routes(string $route): void
    {
        $this->actingAs($this->systemAdmin())
            ->get(route($route))
            ->assertOk();
    }

    #[DataProvider('attributeTableRoutes')]
    public function test_non_admin_with_full_report_permissions_is_denied(string $route): void
    {
        $user = $this->userWith(self::REPORT_PERMISSIONS);

        $this->actingAs($user)
            ->get(route($route))
            ->assertForbidden();
    }

    public function test_attribute_table_export_requires_reports_export_permission(): void
    {
        $user = $this->userWith(['assets.view']);

        $this->actingAs($user)
            ->get(route('reports.attribute-table.export'))
            ->assertForbidden();
    }

    public function test_reports_index_exposes_attribute_table_flag_by_role(): void
    {
        $this->actingAs($this->systemAdmin())
            ->get(route('reports.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/Index')
                ->where('can.viewAttributeTable', true));

        $this->actingAs($this->userWith(self::REPORT_PERMISSIONS))
            ->get(route('reports.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/Index')
                ->where('can.viewAttributeTable', false));
    }

    public function test_authorized_export_prefixes_formula_like_text_only(): void
    {
        $user = $this->systemAdmin();

        $this->makeAsset($user, [
            'species'     => '=HYPERLINK("http://evil.test","x")',
            'description' => '  @SUM(A1:A2)',
            'case_number' => '+1-555',
        ]);
        $this->makeAsset($user, [
            'species'     => 'Narra',
            'description' => 'Regular description',
            'case_number' => 'CC-2026-001',
        ]);

        $csv = $this->actingAs($user)
            ->get(route('reports.attribute-table.export'))
            ->assertOk()
            ->streamedContent();

        $this->assertStringContainsString('"\'=HYPERLINK(', $csv);
        $this->assertStringContainsString('"\'  @SUM(A1:A2)"', $csv);
        $this->assertStringContainsString("'+1-555", $csv);

        $this->assertStringContainsString('Narra', $csv);
        $this->assertStringNotContainsString("'Narra", $csv);
        $this->assertStringContainsString('Regular description', $csv);
        $this->assertStringNotContainsString("'Regular", $csv);
        $this->assertStringContainsString('CC-2026-001', $csv);
        $this->assertStringNotContainsString("'CC-2026-001", $csv);
    }

    public function test_inventory_export_requires_reports_export_permission(): void
    {
        $user = $this->userWith(['assets.view']);

        $this->actingAs($user)
            ->get(route('reports.inventory'))
            ->assertForbidden();
    }

    public function test_inventory_export_prefixes_formula_like_text_only(): void
    {
        $user = $this->userWith(['assets.view', 'reports.view', 'reports.export']);

        $this->makeAsset($user, ['species' => '=HYPERLINK("http://evil.test","x")']);
        $this->makeAsset($user, ['species' => 'Narra']);

        $csv = $this->actingAs($user)
            ->get(route('reports.inventory'))
            ->assertOk()
            ->streamedContent();

        $header = strtok($csv, "\n");
        $this->assertStringContainsString('"Asset Code"', $header);
        $this->assertStringContainsString('Species', $header);
        $this->assertStringNotContainsString("'", $header);

        $this->assertStringContainsString('"\'=HYPERLINK(', $csv);
        $this->assertStringContainsString('Narra', $csv);
        $this->assertStringNotContainsString("'Narra", $csv);
    }
}