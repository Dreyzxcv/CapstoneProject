<?php

namespace App\Http\Requests;

use App\Enums\DisposalType;
use App\Enums\Municipality;
use Illuminate\Foundation\Http\FormRequest;
use App\Enums\DonationOrganizationType;
use App\Models\Asset;
use App\Models\AssetPiece;
use Illuminate\Validation\Rule;

class ProcessDisposalRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('disposals.process');
    }

    protected function isFabrication(): bool
    {
        return $this->input('disposal_type') === DisposalType::Fabricated->value;
    }

    public function rules(): array
    {
        // Fabrication fields are only required when the type is Fabricated.
        $fab = Rule::requiredIf(fn () => $this->isFabrication());

        return [
            'disposal_type' => ['required', Rule::enum(DisposalType::class)],
            'quantity' => ['nullable', 'integer', 'min:1'],
            // Specific pieces picked in the piece picker (Decayed / Fabricated).
            'piece_ids' => ['nullable', 'array'],
            'piece_ids.*' => ['integer', 'distinct'],
            'requester_name' => ['required_if:disposal_type,donation', 'nullable', 'string', 'max:255'],
            'delivery_coordinates' => ['nullable', 'string', 'max:255'],
            'organization_type' => ['required_if:disposal_type,donation', Rule::enum(DonationOrganizationType::class)],
            'organization_type_other' => ['required_if:organization_type,other', 'nullable', 'string', 'max:255'],

            'agency_name' => ['required_if:disposal_type,donation', 'nullable', 'string', 'max:255'],

            'municipality' => ['required_if:disposal_type,donation', 'nullable', Rule::enum(Municipality::class)],
            'barangay' => [
                'required_if:disposal_type,donation',
                'nullable',
                'string',
                'max:255',
                function ($attribute, $value, $fail) {
                    if ($this->input('disposal_type') !== 'donation' || ! $value) {
                        return;
                    }

                    $municipality = $this->input('municipality');
                    $validBarangays = config('barangays')[$municipality] ?? [];

                    if (! in_array($value, $validBarangays, true)) {
                        $fail('The selected barangay is not valid for the chosen municipality.');
                    }
                },
            ],
            'street' => ['nullable', 'string', 'max:255'],

            // Deed of Donation fields
            'donee_position' => ['required_if:disposal_type,donation', 'nullable', 'string', 'max:255'],
            'purpose_statement' => ['required_if:disposal_type,donation', 'nullable', 'string', 'max:2000'],
            'confiscation_order_reference' => ['nullable', 'string', 'max:255'],

            // OIC / donor representative — editable per document; left
            // blank falls back to config/office.php defaults.
            'donor_representative_name' => ['nullable', 'string', 'max:255'],
            'donor_representative_title' => ['nullable', 'string', 'max:255'],

            // Witnesses — editable per document; left blank falls back to
            // config/office.php defaults.
            'witness_1_name' => ['nullable', 'string', 'max:255'],
            'witness_1_title' => ['nullable', 'string', 'max:255'],
            'witness_2_name' => ['nullable', 'string', 'max:255'],
            'witness_2_title' => ['nullable', 'string', 'max:255'],

            'appeal_filed' => ['nullable', 'boolean'],
            'details' => ['nullable', 'array'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'cause_of_decay'     => ['required_if:disposal_type,decayed', 'nullable', 'string', 'max:255'],
            'cause_of_decay_other' => ['required_if:cause_of_decay,Other', 'nullable', 'string', 'max:255'],
            'inspection_date'    => ['required_if:disposal_type,decayed', 'nullable', 'date'],
            'inspecting_officer' => ['required_if:disposal_type,decayed', 'nullable', 'string', 'max:255'],
            'decay_photo'        => ['nullable', 'file', 'image', 'max:8192'],

            // Fabrication fields (stored in disposals.details JSON)
            'fabricated_item'        => [$fab, 'nullable', 'string', 'max:255'],
            'fabricated_item_count'  => [$fab, 'nullable', 'integer', 'min:1', 'max:100000'],
            'fabrication_date'       => [$fab, 'nullable', 'date', 'before_or_equal:today'],
            'fabrication_location'   => [$fab, 'nullable', 'string', 'max:255'],
            'fabricator_name'        => [$fab, 'nullable', 'string', 'max:255'],
            'lumber_used_bd_ft'      => [$fab, 'nullable', 'numeric', 'gt:0', 'max:9999999'],
            'usable_remainder_bd_ft' => ['nullable', 'numeric', 'min:0', 'max:9999999'],
            'scrap_bd_ft'            => ['nullable', 'numeric', 'min:0', 'max:9999999'],
            'fabrication_attachments'   => ['nullable', 'array', 'max:5'],
            'fabrication_attachments.*' => ['file', 'mimes:jpg,jpeg,png,webp,pdf,doc,docx', 'max:8192'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $ids = $this->input('piece_ids');

            if (! is_array($ids) || $ids === [] || $validator->errors()->hasAny(['piece_ids', 'piece_ids.*'])) {
                return;
            }

            $asset = $this->route('asset');
            if (! $asset instanceof Asset) {
                return;
            }

            // Errors go on `quantity` so they show right under the piece picker.
            $pieces = AssetPiece::where('asset_id', $asset->id)->whereIn('id', $ids)->get();

            if ($pieces->count() !== count($ids)) {
                $validator->errors()->add('quantity', 'One or more selected pieces do not belong to this asset.');
            } elseif ($pieces->contains(fn (AssetPiece $p) => $p->isDisposed())) {
                $validator->errors()->add('quantity', 'One or more selected pieces were already disposed. Reload the page and pick again.');
            } elseif ($this->filled('quantity') && count($ids) !== (int) $this->input('quantity')) {
                $validator->errors()->add('quantity', 'The number of selected pieces does not match the quantity.');
            }
        });
    }

    public function attributes(): array
    {
        return [
            'fabricated_item' => 'item fabricated',
            'fabricated_item_count' => 'number of finished items',
            'fabrication_date' => 'fabrication date',
            'fabrication_location' => 'workshop / location',
            'fabricator_name' => 'responsible officer / fabricator',
            'lumber_used_bd_ft' => 'lumber used',
            'usable_remainder_bd_ft' => 'usable remainder',
            'scrap_bd_ft' => 'scrap',
            'fabrication_attachments' => 'supporting files',
            'fabrication_attachments.*' => 'supporting file',
        ];
    }
}