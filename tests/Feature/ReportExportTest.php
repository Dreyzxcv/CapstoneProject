<?php

namespace Tests\Feature;

use App\Enums\AssetMode;
use App\Enums\AssetStatus;
use App\Enums\AssetType;
use App\Enums\Municipality;
use App\Models\Asset;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Illuminate\Support\Str;
use Tests\TestCase;

class ReportExportTest extends TestCase
{
    use RefreshDatabase;

    private function userWith(array $permissions): User
    {
        $user = User::factory()->create();

        foreach ($permissions as $name) {
            Permission::findOrCreate($name, 'web');
            $user->givePermissionTo($name);
        }

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

    public function test_attribute_table_export_requires_reports_export_permission(): void
    {
        $user = $this->userWith(['assets.view']);

        $this->actingAs($user)
            ->get(route('reports.attribute-table.export'))
            ->assertForbidden();
    }

    public function test_authorized_export_prefixes_formula_like_text_only(): void
    {
        $user = $this->userWith(['assets.view', 'reports.export']);

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

        $response = $this->actingAs($user)
            ->get(route('reports.attribute-table.export'))
            ->assertOk();

        $csv = $response->streamedContent();

        // Formula-like values are neutralised
        $this->assertStringContainsString('"\'=HYPERLINK(', $csv);
        $this->assertStringContainsString('"\'  @SUM(A1:A2)"', $csv);
        $this->assertStringContainsString("'+1-555", $csv);

        // Ordinary values stay unchanged
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
        $user = $this->userWith(['assets.view', 'reports.export']);

        $this->makeAsset($user, [
            'species' => '=HYPERLINK("http://evil.test","x")',
        ]);
        $this->makeAsset($user, [
            'species' => 'Narra',
        ]);

        $response = $this->actingAs($user)
            ->get(route('reports.inventory'))
            ->assertOk();

        $csv = $response->streamedContent();

        // Headers are untouched
        $header = strtok($csv, "\n");
        $this->assertStringContainsString('"Asset Code"', $header);
        $this->assertStringContainsString('Species', $header);
        $this->assertStringNotContainsString("'", $header);

        // Formula-like value is neutralised
        $this->assertStringContainsString('"\'=HYPERLINK(', $csv);

        // Ordinary value stays unchanged
        $this->assertStringContainsString('Narra', $csv);
        $this->assertStringNotContainsString("'Narra", $csv);
    }
}