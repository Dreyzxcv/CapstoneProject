<?php

namespace App\Http\Controllers;

use App\Models\AssetPiece;
use Illuminate\Http\Request;

class AssetPieceController extends Controller
{
    public function update(Request $request, AssetPiece $piece)
    {
        $this->authorize('update', $piece->asset);

        $asset = $piece->asset;

        $rules = [
            'description' => ['nullable', 'string', 'max:1000'],
        ];

        if ($asset->type === 'log' || $asset->type === 'wildlife') {
            $rules['species'] = ['nullable', 'string', 'max:255'];
        }

        if ($asset->type === 'log') {
            $rules['length'] = ['nullable', 'numeric', 'min:0'];
            $rules['width']  = ['nullable', 'numeric', 'min:0'];
            $rules['height'] = ['nullable', 'numeric', 'min:0'];
        }

        if ($asset->type === 'vehicle') {
            $rules['vehicle_type']  = ['nullable', 'string', 'max:255'];
            $rules['plate_number']  = ['nullable', 'string', 'max:255'];
        }

        if ($asset->type === 'equipment') {
            $rules['equipment_type'] = ['nullable', 'string', 'max:255'];
            $rules['serial_number']  = ['nullable', 'string', 'max:255'];
        }

        $validated = $request->validate($rules);

        // Recompute volumes if dimensions changed (log type only)
        if ($asset->type === 'log') {
            $l = $validated['length'] ?? $piece->length ?? 0;
            $w = $validated['width']  ?? $piece->width  ?? 0;
            $h = $validated['height'] ?? $piece->height ?? 0;

            if ($l && $w && $h) {
                // bd.ft = (L × W × H) / 12  (dimensions in inches)
                $validated['volume_bd_ft'] = round(($l * $w * $h) / 12, 4);
                // cu.m = bd.ft × 0.002360
                $validated['volume_cu_m']  = round($validated['volume_bd_ft'] * 0.002360, 4);
            }
        }

        $piece->update($validated);

        // Recompute asset-level aggregates if volumes changed
        if ($asset->type === 'log') {
            $asset->volume_bd_ft    = $asset->pieces()->sum('volume_bd_ft');
            $asset->volume_cu_m     = $asset->pieces()->sum('volume_cu_m');
            $asset->estimated_value = $asset->pieces()->sum('estimated_value');
            $asset->save();
        }

        return back();
    }
}