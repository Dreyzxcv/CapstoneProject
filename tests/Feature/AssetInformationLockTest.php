<?php

namespace Tests\Feature;

use App\Enums\AssetMode;
use App\Enums\AssetStatus;
use App\Enums\AssetType;
use App\Enums\Municipality;
use App\Models\Asset;
use App\Models\AssetPiece;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AssetInformationLockTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function user(string $role): User
    {
        return User::factory()->create()->assignRole($role);
    }

    private function makeAsset(AssetStatus $status): Asset
    {
        $creator = User::factory()->create();

        return Asset::create([
            'asset_code'             => 'TEST-'.Str::upper(Str::random(8)),
            'item_number'            => 1,
            'type'                   => AssetType::Log,
            'quantity'               => 1,
            'quantity_unit'          => 'pcs',
            'municipality_of_origin' => Municipality::cases()[0]->value,
            'location_apprehended'   => 'Virac',
            'apprehending_agency'    => 'PENRO',
            'mode'                   => AssetMode::Apprehended,
            'has_ongoing_case'       => true,
            'has_confiscation_order' => false,
            'current_status'         => $status,
            'qr_code_token'          => Str::random(40),
            'created_by'             => $creator->id,
        ]);
    }

    private function makePiece(Asset $asset): AssetPiece
    {
        return AssetPiece::create([
            'asset_id'      => $asset->id,
            'piece_number'  => 1,
            'qr_code_token' => Str::random(40),
            'species'       => 'Narra',
        ]);
    }

    private function assetPayload(): array
    {
        return [
            'location_apprehended' => 'Virac',
            'apprehending_agency'  => 'PENRO Updated',
            'mode'                 => AssetMode::Apprehended->value,
        ];
    }

    public function test_non_admin_cannot_edit_asset_information_at_documents_verified(): void
    {
        $asset = $this->makeAsset(AssetStatus::DocumentsVerified);
        $piece = $this->makePiece($asset);
        $mes   = $this->user('MES Officer');

        $this->actingAs($mes)->put(route('assets.update', $asset), $this->assetPayload())->assertForbidden();
        $this->actingAs($mes)->put(route('asset-pieces.update', $piece), ['description' => 'x'])->assertForbidden();
        $this->actingAs($mes)->post(route('assets.stcp-number.update', $asset), ['stcp_number' => 'STCP-1'])->assertForbidden();
        $this->actingAs($mes)->post(route('assets.case-details.update', $asset), ['case_number' => 'C-1'])->assertForbidden();

        $this->assertSame('PENRO', $asset->fresh()->apprehending_agency);
        $this->assertNull($asset->fresh()->stcp_number);
    }

    public function test_system_admin_can_still_edit_at_documents_verified(): void
    {
        $asset = $this->makeAsset(AssetStatus::DocumentsVerified);
        $piece = $this->makePiece($asset);
        $admin = $this->user('System Admin');

        $this->actingAs($admin)->put(route('assets.update', $asset), $this->assetPayload())
            ->assertSessionHasNoErrors()->assertRedirect();
        $this->actingAs($admin)->put(route('asset-pieces.update', $piece), ['description' => 'x'])->assertRedirect();
        $this->actingAs($admin)->post(route('assets.stcp-number.update', $asset), ['stcp_number' => 'STCP-1'])->assertRedirect();
        $this->actingAs($admin)->post(route('assets.case-details.update', $asset), ['case_number' => 'C-1'])->assertRedirect();

        $this->assertSame('PENRO Updated', $asset->fresh()->apprehending_agency);
    }

    public function test_non_admin_can_still_edit_at_other_statuses(): void
    {
        foreach ([AssetStatus::IntakeRecorded, AssetStatus::PendingCustodyReview, AssetStatus::Stored] as $status) {
            $asset = $this->makeAsset($status);
            $piece = $this->makePiece($asset);
            $mes   = $this->user('MES Officer');

            $this->actingAs($mes)->put(route('assets.update', $asset), $this->assetPayload())
                ->assertSessionHasNoErrors()->assertRedirect();
            $this->actingAs($mes)->put(route('asset-pieces.update', $piece), ['description' => 'x'])->assertRedirect();
            $this->actingAs($mes)->post(route('assets.stcp-number.update', $asset), ['stcp_number' => 'STCP-1'])->assertRedirect();
            $this->actingAs($mes)->post(route('assets.case-details.update', $asset), ['case_number' => 'C-1'])->assertRedirect();
        }
    }

    public function test_show_page_flags_reflect_lock(): void
    {
        $asset = $this->makeAsset(AssetStatus::DocumentsVerified);

        $this->actingAs($this->user('MES Officer'))->get(route('assets.show', $asset))
            ->assertInertia(fn ($p) => $p->where('can.edit', false)->where('can.updateCaseDetails', false));

        $this->actingAs($this->user('System Admin'))->get(route('assets.show', $asset))
            ->assertInertia(fn ($p) => $p->where('can.edit', true)->where('can.updateCaseDetails', true));
    }
}