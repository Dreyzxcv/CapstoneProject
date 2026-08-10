<?php

namespace Database\Seeders;

use App\Actions\CreateAsset;
use App\Enums\AssetMode;
use App\Enums\AssetStatus;
use App\Enums\AssetType;
use App\Models\Asset;
use App\Models\AssetCaseStatusHistory;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $users = [
            ['name' => 'System Admin', 'email' => 'admin@penro-catanduanes.gov.ph', 'role' => 'System Admin'],
            ['name' => 'MES Officer', 'email' => 'mes@penro-catanduanes.gov.ph', 'role' => 'MES Officer'],
            ['name' => 'Property Custodian', 'email' => 'custodian@penro-catanduanes.gov.ph', 'role' => 'Property Custodian'],
            ['name' => 'Accounting Officer', 'email' => 'accounting@penro-catanduanes.gov.ph', 'role' => 'Accounting Officer'],
            ['name' => 'PENRO Supervisor', 'email' => 'management@penro-catanduanes.gov.ph', 'role' => 'PENRO Management'],
        ];

        foreach ($users as $data) {
            $user = User::firstOrCreate(
                ['email' => $data['email']],
                [
                    'name' => $data['name'],
                    'password' => Hash::make('Password123!'),
                    'is_active' => true,
                    'email_verified_at' => now(),
                ]
            );
            $user->syncRoles([$data['role']]);
        }

        $mes = User::where('email', 'mes@penro-catanduanes.gov.ph')->first();
        $createAsset = app(CreateAsset::class);

        if (Asset::count() === 0) {
            $samples = [
                [
                    'type' => AssetType::Log->value,
                    'species' => 'Narra',
                    'description' => 'Confiscated lumber, 12 pieces',
                    'municipality_of_origin' => 'Virac',
                    'location_apprehended' => 'Barangay Calatagan Proper',
                    'apprehending_agency' => 'PENRO Catanduanes MES',
                    'mode' => AssetMode::Apprehended->value,
                    'has_ongoing_case' => true,
                    'has_confiscation_order' => false,
                ],
                [
                    'type' => AssetType::Equipment->value,
                    'species' => null,
                    'description' => 'Stihl MS 382 chainsaw',
                    'municipality_of_origin' => 'San Andres',
                    'location_apprehended' => 'Barangay Timbaan',
                    'apprehending_agency' => 'PENRO Catanduanes MES',
                    'mode' => AssetMode::Apprehended->value,
                    'has_claimant' => false,
                    'has_ongoing_case' => false,
                    'has_confiscation_order' => true,
                ],
                [
                    'type' => AssetType::Vehicle->value,
                    'species' => null,
                    'description' => 'Tricycle with illegally sourced lumber',
                    'municipality_of_origin' => 'Caramoran',
                    'location_apprehended' => 'Caramoran Public Market',
                    'apprehending_agency' => 'PENRO Catanduanes MES',
                    'mode' => AssetMode::TurnedOver->value,
                    'has_ongoing_case' => false,
                    'has_confiscation_order' => true,
                ],
            ];

            foreach ($samples as $sample) {
                $createAsset->execute($sample, $mes);
            }

            $storedAsset = Asset::first();
            if ($storedAsset) {
                $storedAsset->update(['current_status' => AssetStatus::Stored]);
                AssetCaseStatusHistory::create([
                    'asset_id' => $storedAsset->id,
                    'status' => AssetStatus::Stored,
                    'changed_by' => $mes->id,
                    'notes' => 'Demo: pre-stored asset',
                    'changed_at' => now(),
                ]);
            }
        }
    }
}
