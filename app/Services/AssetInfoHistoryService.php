<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\AssetCaseStatusHistory;
use BackedEnum;
use Carbon\CarbonInterface;

class AssetInfoHistoryService
{
    public const ASSET_LABELS = [
        'location_apprehended'    => 'Location',
        'apprehending_agency'     => 'Agency',
        'mode'                    => 'Mode',
        'has_ongoing_case'        => 'Ongoing case',
        'has_confiscation_order'  => 'Confiscation order',
        'date_of_apprehension'    => 'Date of apprehension',
        'place_of_apprehension'   => 'Place of apprehension',
        'area'                    => 'Land class',
        'coordinates'             => 'Coordinates',
        'apprehending_party'      => 'Apprehending party',
        'has_claimant'            => 'Claimant came forward',
        'claimant_offender_name'  => 'Claimant / offender name',
        // Personal data: shown as "updated" only, never the values.
        'claimant_address'        => 'Claimant contact and ID details',
        'claimant_contact_number' => 'Claimant contact and ID details',
        'claimant_id_type'        => 'Claimant contact and ID details',
        'claimant_id_number'      => 'Claimant contact and ID details',
    ];

    public const PRIVATE_FIELDS = [
        'claimant_address',
        'claimant_contact_number',
        'claimant_id_type',
        'claimant_id_number',
    ];

    /**
     * Compare two snapshots and return the list of changed fields.
     *
     * @param  array<string,mixed>  $before
     * @param  array<string,mixed>  $after
     * @param  array<string,string> $labels   field => label
     * @param  array<int,string>    $private  fields whose values must not be shown
     */
    public function diff(array $before, array $after, array $labels, array $private = []): array
    {
        $changes     = [];
        $seenPrivate = [];

        foreach ($labels as $field => $label) {
            if ($this->normalize($before[$field] ?? null) === $this->normalize($after[$field] ?? null)) {
                continue;
            }

            if (in_array($field, $private, true)) {
                if (isset($seenPrivate[$label])) {
                    continue;
                }
                $seenPrivate[$label] = true;
                $changes[] = ['label' => $label, 'private' => true];
                continue;
            }

            $changes[] = [
                'label' => $label,
                'from'  => $this->display($before[$field] ?? null),
                'to'    => $this->display($after[$field] ?? null),
            ];
        }

        return $changes;
    }

    /**
     * Add an "information updated" row to the asset's status history.
     * Does nothing when there are no changes. Does NOT change the asset's status.
     */
    public function record(Asset $asset, array $changes, int $userId): ?AssetCaseStatusHistory
    {
        if ($changes === []) {
            return null;
        }

        return AssetCaseStatusHistory::create([
            'asset_id'       => $asset->id,
            'status'         => $asset->current_status,
            'event_type'     => 'info_updated',
            'changed_fields' => $changes,
            'changed_by'     => $userId,
            'changed_at'     => now(),
        ]);
    }

    protected function normalize(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }
        if ($value instanceof BackedEnum) {
            return (string) $value->value;
        }
        if ($value instanceof CarbonInterface) {
            return $value->toDateString();
        }
        if (is_bool($value)) {
            return $value ? '1' : '0';
        }

        return trim((string) $value);
    }

    protected function display(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }
        if ($value instanceof BackedEnum) {
            return method_exists($value, 'label') ? $value->label() : (string) $value->value;
        }
        if ($value instanceof CarbonInterface) {
            return $value->toFormattedDateString();
        }

        return (string) $value;
    }
}