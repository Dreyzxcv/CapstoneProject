<?php

namespace Tests\Feature;

use App\Actions\ProcessBatchDonation;
use App\Actions\ProcessDisposal;
use App\Enums\AssetMode;
use App\Enums\AssetStatus;
use App\Enums\AssetType;
use App\Enums\DonationOrganizationType;
use App\Enums\Municipality;
use App\Models\Asset;
use App\Models\Disposal;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class DonationFlowRequirementsTest extends TestCase
{
    use RefreshDatabase;

    private ?array $capturedDetails = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        // Capture what would be persisted, without generating PDFs etc.
        $this->mock(ProcessBatchDonation::class, function ($mock) {
            $mock->shouldReceive('execute')->andReturnUsing(function ($lines, $details) {
                $this->capturedDetails = $details;
                return collect();
            });
        });
        $this->mock(ProcessDisposal::class, function ($mock) {
            $mock->shouldReceive('execute')->andReturnUsing(function ($asset, $type, $user, $details) {
                $this->capturedDetails = $details;
                return new Disposal();
            });
        });
    }

    private const FLOWS = ['standard', 'batch'];

    private function makeAsset(): Asset
    {
        return Asset::create([
            'asset_code'             => 'TEST-'.Str::upper(Str::random(8)),
            'item_number'            => 1,
            'type'                   => AssetType::Log,
            'quantity'               => 5,
            'quantity_unit'          => 'pcs',
            'municipality_of_origin' => Municipality::cases()[0]->value,
            'location_apprehended'   => 'Virac',
            'apprehending_agency'    => 'PENRO',
            'mode'                   => AssetMode::Apprehended,
            'has_ongoing_case'       => false,
            'has_confiscation_order' => true,
            'current_status'         => AssetStatus::ForDisposal,
            'qr_code_token'          => Str::random(40),
            'created_by'             => User::factory()->create()->id,
        ]);
    }

    private function validAddress(): array
    {
        $municipality = array_key_first(config('barangays'));

        return [$municipality, config('barangays')[$municipality][0]];
    }

    private function payload(array $overrides = []): array
    {
        [$municipality, $barangay] = $this->validAddress();

        return array_merge([
            'requester_name'    => 'Juan Dela Cruz',
            'organization_type' => 'lgu',
            'agency_name'       => 'Virac Fire Station',
            'municipality'      => $municipality,
            'barangay'          => $barangay,
            'street'            => 'Purok 3, Zone 2',
            'donee_position'    => 'Fire Marshal',
            'purpose_statement' => 'office renovation',
        ], $overrides);
    }

    private function submit(string $flow, array $payload)
    {
        $this->capturedDetails = null;
        $asset = $this->makeAsset();
        $admin = User::factory()->create()->assignRole('System Admin');

        if ($flow === 'batch') {
            return $this->actingAs($admin)->post(route('disposals.donate.store'), $payload + [
                'lines' => [['asset_id' => $asset->id, 'quantity' => 1]],
            ]);
        }

        return $this->actingAs($admin)->post(route('disposals.store', $asset), $payload + [
            'disposal_type' => 'donation',
            'quantity'      => 1,
        ]);
    }

    public function test_allowed_organization_types_are_accepted_in_both_flows(): void
    {
        foreach (self::FLOWS as $flow) {
            foreach (['academe', 'national_agency', 'lgu', 'other'] as $type) {
                $extra = $type === 'other' ? ['organization_type_other' => 'Cooperative'] : [];

                $this->submit($flow, $this->payload(['organization_type' => $type] + $extra))
                    ->assertSessionHasNoErrors();

                $this->assertSame($type, $this->capturedDetails['organization_type'] ?? null, "$flow / $type");
            }
        }
    }

    public function test_individual_and_blank_organization_types_are_rejected_in_both_flows(): void
    {
        foreach (self::FLOWS as $flow) {
            foreach (['individual', ''] as $type) {
                $this->submit($flow, $this->payload(['organization_type' => $type]))
                    ->assertSessionHasErrors('organization_type');

                $this->assertNull($this->capturedDetails, "$flow / '$type' must not reach the action");
            }
        }
    }

    public function test_municipality_and_barangay_are_validated_in_both_flows(): void
    {
        foreach (self::FLOWS as $flow) {
            $this->submit($flow, $this->payload(['barangay' => 'Not A Real Barangay']))
                ->assertSessionHasErrors('barangay');

            $this->submit($flow, $this->payload(['municipality' => 'Atlantis']))
                ->assertSessionHasErrors('municipality');

            $this->submit($flow, $this->payload())->assertSessionHasNoErrors();
        }
    }

    public function test_street_is_still_saved_and_remains_optional_in_both_flows(): void
    {
        foreach (self::FLOWS as $flow) {
            $this->submit($flow, $this->payload(['street' => 'Purok 3, Zone 2']))
                ->assertSessionHasNoErrors();
            $this->assertSame('Purok 3, Zone 2', $this->capturedDetails['street'] ?? null, $flow);

            $noStreet = $this->payload();
            unset($noStreet['street']);
            $this->submit($flow, $noStreet)->assertSessionHasNoErrors();
        }
    }

    public function test_delivery_coordinates_are_no_longer_accepted_or_saved(): void
    {
        foreach (self::FLOWS as $flow) {
            $this->submit($flow, $this->payload(['delivery_coordinates' => '13.5833, 124.2333']))
                ->assertSessionHasNoErrors();

            $this->assertNotNull($this->capturedDetails, $flow);
            $this->assertArrayNotHasKey('delivery_coordinates', $this->capturedDetails, $flow);
        }
    }

    public function test_individual_is_no_longer_an_organization_type(): void
    {
        $this->assertNull(DonationOrganizationType::tryFrom('individual'));
        $this->assertEqualsCanonicalizing(
            ['academe', 'national_agency', 'lgu', 'other'],
            array_map(fn ($c) => $c->value, DonationOrganizationType::cases()),
        );
    }
}