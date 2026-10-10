import Modal from '@/Components/Modal';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';

const CATANDUANES_BOUNDS: [[number, number], [number, number]] = [
    [13.40, 124.05],
    [14.10, 124.45],
];
const CATANDUANES_CENTER: [number, number] = [13.75, 124.24];

// Soft pulsing highlight that guides the user: Latitude -> Longitude -> Zoom -> Use.
const HIGHLIGHT_CSS = `
@keyframes nfPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(5, 150, 105, 0.45); }
    50%      { box-shadow: 0 0 0 6px rgba(5, 150, 105, 0); }
}
.nf-highlight {
    border-color: #059669 !important;
    animation: nfPulse 1.6s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
    .nf-highlight { animation: none; box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.35); }
}
`;

interface CoordinatesPickerModalProps {
    show: boolean;
    onClose: () => void;
    onSelect: (coordinates: string) => void;
    initialCoordinates?: string;
}

function parseCoordinates(value?: string): { lat: string; lng: string } {
    if (!value) return { lat: '', lng: '' };
    const match = value.match(/(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)/);
    if (!match) return { lat: '', lng: '' };
    return { lat: match[1], lng: match[3] };
}

function isNumber(value: string): boolean {
    return value.trim() !== '' && !Number.isNaN(parseFloat(value));
}

export default function CoordinatesPickerModal({
    show,
    onClose,
    onSelect,
    initialCoordinates,
}: CoordinatesPickerModalProps) {
    // Callback ref instead of a plain ref object. This fires the moment the
    // <div> actually mounts into the DOM, so map init isn't racing against
    // HeadlessUI's Transition mounting the modal's children asynchronously.
    const [container, setContainer] = useState<HTMLDivElement | null>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const markerRef = useRef<LeafletMarker | null>(null);

    const parsed = parseCoordinates(initialCoordinates);
    const [lat, setLat] = useState(parsed.lat);
    const [lng, setLng] = useState(parsed.lng);
    const [error, setError] = useState<string | null>(null);

    // Remembers which lat/lng the map is currently showing (via Zoom, a map
    // click, or the initial value). When the inputs differ from this, the
    // Zoom button is the next thing to press.
    const [zoomedKey, setZoomedKey] = useState('');
    const currentKey = `${lat}|${lng}`;

    // ── Guided highlight: which control should pulse next ────────────────
    const nextTarget: 'lat' | 'lng' | 'zoom' | 'use' =
        !isNumber(lat) ? 'lat'
        : !isNumber(lng) ? 'lng'
        : zoomedKey !== currentKey ? 'zoom'
        : 'use';
    const hl = (key: typeof nextTarget) => (nextTarget === key ? 'nf-highlight' : '');

    useEffect(() => {
        if (!show || !container || mapRef.current) return;

        let cancelled = false;
        let resizeObserver: ResizeObserver | null = null;

        import('leaflet')
            .then((L) => {
                if (cancelled || !container || mapRef.current) return;

                delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
                L.Icon.Default.mergeOptions({
                    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                });

                const map = L.map(container, {
                    center: CATANDUANES_CENTER,
                    zoom: 10,
                    minZoom: 9,
                    maxZoom: 17,
                    maxBounds: CATANDUANES_BOUNDS,
                    maxBoundsViscosity: 1.0,
                });

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors',
                }).addTo(map);

                map.fitBounds(CATANDUANES_BOUNDS);

                map.on('click', (e) => {
                    const { lat: clickLat, lng: clickLng } = e.latlng;
                    placeMarker(L, map, clickLat, clickLng);
                    const latStr = clickLat.toFixed(6);
                    const lngStr = clickLng.toFixed(6);
                    setLat(latStr);
                    setLng(lngStr);
                    // The marker is already on the clicked point, so no Zoom needed.
                    setZoomedKey(`${latStr}|${lngStr}`);
                    setError(null);
                });

                mapRef.current = map;

                const initLat = parseFloat(parsed.lat);
                const initLng = parseFloat(parsed.lng);
                if (!Number.isNaN(initLat) && !Number.isNaN(initLng)) {
                    placeMarker(L, map, initLat, initLng);
                    map.setView([initLat, initLng], 14);
                    setZoomedKey(`${parsed.lat}|${parsed.lng}`);
                }

                // The modal may finish its open transition (changing size)
                // after Leaflet has already measured the container, so we
                // still need to invalidateSize once it settles.
                resizeObserver = new ResizeObserver((entries) => {
                    const { width, height } = entries[0].contentRect;
                    if (width > 0 && height > 0) {
                        map.invalidateSize();
                    }
                });
                resizeObserver.observe(container);
            })
            .catch((err) => {
                console.error('Failed to load map:', err);
                setError('Could not load the map. Please try again.');
            });

        return () => {
            cancelled = true;
            resizeObserver?.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show, container]);

    useEffect(() => {
        if (show) return;
        mapRef.current?.remove();
        mapRef.current = null;
        markerRef.current = null;
        setZoomedKey('');
    }, [show]);

    function placeMarker(L: typeof import('leaflet'), map: LeafletMap, latVal: number, lngVal: number) {
        if (markerRef.current) {
            markerRef.current.setLatLng([latVal, lngVal]);
        } else {
            markerRef.current = L.marker([latVal, lngVal]).addTo(map);
        }
    }

    function handleZoomToCoordinates() {
        const latNum = parseFloat(lat);
        const lngNum = parseFloat(lng);

        if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
            setError('Enter valid decimal latitude and longitude.');
            return;
        }

        const withinLat = latNum >= CATANDUANES_BOUNDS[0][0] && latNum <= CATANDUANES_BOUNDS[1][0];
        const withinLng = lngNum >= CATANDUANES_BOUNDS[0][1] && lngNum <= CATANDUANES_BOUNDS[1][1];

        if (!withinLat || !withinLng) {
            setError('Those coordinates fall outside Catanduanes. Double-check the values.');
            return;
        }

        setError(null);

        import('leaflet').then((L) => {
            const map = mapRef.current;
            if (!map) return;
            placeMarker(L, map, latNum, lngNum);
            map.setView([latNum, lngNum], 15, { animate: true });
            // Zoom done -> move the pulse to "Use These Coordinates".
            setZoomedKey(`${lat}|${lng}`);
        });
    }

    function handleUseLocation() {
        if (!lat || !lng) {
            setError('Pick a point on the map or enter coordinates first.');
            return;
        }

        const latNum = parseFloat(lat);
        const lngNum = parseFloat(lng);

        if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
            setError('Invalid coordinates. Please try again.');
            return;
        }

        const withinLat = latNum >= CATANDUANES_BOUNDS[0][0] && latNum <= CATANDUANES_BOUNDS[1][0];
        const withinLng = lngNum >= CATANDUANES_BOUNDS[0][1] && lngNum <= CATANDUANES_BOUNDS[1][1];

        if (!withinLat || !withinLng) {
            setError('Those coordinates fall outside Catanduanes. Pick a point inside the island.');
            return;
        }

        setError(null);
        onSelect(`${latNum.toFixed(6)}, ${lngNum.toFixed(6)}`);
        onClose();
    }

    return (
        <Modal show={show} onClose={onClose} maxWidth="2xl">
            <style>{HIGHLIGHT_CSS}</style>
            <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900">Pick Coordinates</h2>
                <p className="mt-1 text-sm text-gray-600">
                    Enter decimal latitude/longitude and click Zoom, or click directly on the map. The map is
                    restricted to Catanduanes.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <div className="space-y-1">
                        <Label htmlFor="picker_lat">Latitude</Label>
                        <Input
                            id="picker_lat"
                            type="text"
                            inputMode="decimal"
                            placeholder="13.5833"
                            value={lat}
                            className={hl('lat')}
                            onChange={(e) => setLat(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="picker_lng">Longitude</Label>
                        <Input
                            id="picker_lng"
                            type="text"
                            inputMode="decimal"
                            placeholder="124.2333"
                            value={lng}
                            className={hl('lng')}
                            onChange={(e) => setLng(e.target.value)}
                        />
                    </div>
                    <div className="flex items-end">
                        <Button
                            type="button"
                            variant="secondary"
                            className={hl('zoom')}
                            onClick={handleZoomToCoordinates}
                        >
                            Zoom
                        </Button>
                    </div>
                </div>

                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

                <div
                    ref={setContainer}
                    className="mt-4 h-80 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
                />

                <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="button" className={hl('use')} onClick={handleUseLocation}>
                        Use These Coordinates
                    </Button>
                </div>
            </div>
        </Modal>
    );
}