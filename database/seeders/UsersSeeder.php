<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UsersSeeder extends Seeder
{
    public function run(): void
    {
        $users = [
            ['name' => 'System Admin',      'email' => 'admin@penro-catanduanes.gov.ph',      'role' => 'System Admin'],
            ['name' => 'MES Officer',        'email' => 'mes@penro-catanduanes.gov.ph',        'role' => 'MES Officer'],
            ['name' => 'Property Custodian', 'email' => 'custodian@penro-catanduanes.gov.ph',  'role' => 'Property Custodian'],
            ['name' => 'Accounting Officer', 'email' => 'accounting@penro-catanduanes.gov.ph', 'role' => 'Accounting Officer'],
            ['name' => 'PENRO Supervisor',   'email' => 'management@penro-catanduanes.gov.ph', 'role' => 'PENRO Management'],
        ];

        foreach ($users as $data) {
            $user = User::firstOrCreate(
                ['email' => $data['email']],
                [
                    'name'              => $data['name'],
                    'password'          => Hash::make('Password123!'),
                    'is_active'         => true,
                    'email_verified_at' => now(),
                ]
            );
            $user->syncRoles([$data['role']]);
        }
    }
}