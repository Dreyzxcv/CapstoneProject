<?php

namespace App\Support;

final class AreaPermissions
{
    public const ADMIN_ROLE = 'System Admin';

    /** Never configurable per user. Listed for documentation and tests. */
    public const ADMIN_ONLY = ['users.manage', 'audit.view', 'market_prices.manage', 'backup.run'];

    public static function areas(): array
    {
        return [
            'assets' => [
                'label' => 'Assets', 'group' => 'Inventory',
                'description' => 'Asset list, details, QR scanning, documents and incident reports.',
                'view' => 'assets.view',
                'dependents' => [
                    'assets.create', 'assets.update', 'assets.sign_receipt', 'assets.mark_stored',
                    'assets.generate_qr', 'assets.update_case', 'assets.update_aap', 'assets.scan',
                    'assets.submit_custody_review', 'incidents.create', 'documents.upload', 'documents.verify',
                ],
            ],
            'disposals' => [
                'label' => 'Disposals', 'group' => 'Inventory',
                'description' => 'Disposal and donation records.',
                'view' => 'disposals.view', 'dependents' => ['disposals.process'],
            ],
            'jev' => [
                'label' => 'JEV', 'group' => 'Finance',
                'description' => 'Journal entry vouchers.',
                'view' => 'jev.view', 'dependents' => ['jev.create', 'jev.upload'],
            ],
            'reports' => [
                'label' => 'Reports', 'group' => 'Reporting',
                'description' => 'Inventory, compliance and donation reports.',
                'view' => 'reports.view', 'dependents' => ['reports.export'],
            ],
        ];
    }

    public static function keys(): array
    {
        return array_keys(self::areas());
    }

    public static function viewPermissions(): array
    {
        return array_column(self::areas(), 'view');
    }

    /** Permissions removed when the given view permissions are revoked. */
    public static function deniedBy(array $overrides): array
    {
        $denied = [];
        foreach (self::areas() as $area) {
            if (($overrides[$area['view']] ?? null) === false) {
                $denied = [...$denied, $area['view'], ...$area['dependents']];
            }
        }
        return $denied;
    }
}