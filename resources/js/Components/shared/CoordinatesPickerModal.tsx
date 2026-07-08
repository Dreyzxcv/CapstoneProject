import Modal from '@/Components/Modal';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';

const CATANDUANES_BOUNDS: [[number, number], [number, number]] = [
    [13.45, 123.95],
    [13.95, 124.45],
];
const CATANDUANES_CENTER: [number, number] = [13.7, 124.24];

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

export default function CoordinatesPickerModal({
    show,
    onClose,
    onSelect,
    initialCoordinates,
}: CoordinatesPickerModalProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const markerRef = useRef<LeafletMarker | null>(null);

    const parsed = parseCoordinates(initialCoordinates);
    const [lat, setLat] = useState(parsed.lat);
    const [lng, setLng] = useState(parsed.lng);
    const [error, setError] = useState<string | null>(null);

    // --- DEBUG PANEL STATE ---
    const [debugLog, setDebugLog] = useState<string[]>([]);
    const log = (msg: string) => {
        const line = `${new Date().toISOString().split('T')[1].slice(0, 12)}  ${msg}`;
        console.log('[MAP DEBUG]', msg);
        setDebugLog((prev) => [...prev.slice(-30), line]);
    };

    useEffect(() => {
        if (!show || !mapContainerRef.current || mapRef.current) return;

        const container = mapContainerRef.current;
        log(`effect fired. container size at start: ${container.offsetWidth}x${container.offsetHeight}`);

        let cancelled = false;
        let resizeObserver: ResizeObserver | null = null;

        import('leaflet')
            .then((L) => {
                log(`leaflet module loaded, version ${L.version ?? 'unknown'}`);

                if (cancelled) {
                    log('aborted: effect cancelled before leaflet finished loading');
                    return;
                }
                if (!container) {
                    log('aborted: container ref is null');
                    return;
                }
                if (mapRef.current) {
                    log('aborted: map already exists');
                    return;
                }

                log(`container size right before map init: ${container.offsetWidth}x${container.offsetHeight}`);

                delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
                L.Icon.Default.mergeOptions({
                    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                });

                let map: LeafletMap;
                try {
                    map = L.map(container, {
                        center: CATANDUANES_CENTER,
                        zoom: 10,
                        minZoom: 9,
                        maxZoom: 17,
                        maxBounds: CATANDUANES_BOUNDS,
                        maxBoundsViscosity: 1.0,
                    });
                    log('L.map() succeeded');
                } catch (mapErr) {
                    log(`L.map() THREW: ${String(mapErr)}`);
                    return;
                }

                log(`map size per leaflet: ${JSON.stringify(map.getSize())}`);

                const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors',
                });

                tileLayer.on('loading', () => log('tileLayer: loading started'));
                tileLayer.on('load', () => log('tileLayer: all visible tiles loaded'));
                tileLayer.on('tileloadstart', (e: any) => log(`tile load start: ${e.coords?.x},${e.coords?.y},${e.coords?.z}`));
                tileLayer.on('tileerror', (e: any) => log(`TILE ERROR: ${e.coords?.x},${e.coords?.y},${e.coords?.z} - ${e.error ?? 'unknown error'}`));

                tileLayer.addTo(map);
                log('tileLayer.addTo(map) called');

                map.fitBounds(CATANDUANES_BOUNDS);
                log(`after fitBounds, map size: ${JSON.stringify(map.getSize())}, zoom: ${map.getZoom()}`);

                map.on('click', (e) => {
                    const { lat: clickLat, lng: clickLng } = e.latlng;
                    placeMarker(L, map, clickLat, clickLng);
                    setLat(clickLat.toFixed(6));
                    setLng(clickLng.toFixed(6));
                    setError(null);
                });

                mapRef.current = map;

                const initLat = parseFloat(parsed.lat);
                const initLng = parseFloat(parsed.lng);
                if (!Number.isNaN(initLat) && !Number.isNaN(initLng)) {
                    placeMarker(L, map, initLat, initLng);
                    map.setView([initLat, initLng], 14);
                }

                resizeObserver = new ResizeObserver((entries) => {
                    const { width, height } = entries[0].contentRect;
                    log(`ResizeObserver fired: ${width}x${height}`);
                    if (width > 0 && height > 0) {
                        map.invalidateSize();
                        log(`invalidateSize() called, map size now: ${JSON.stringify(map.getSize())}`);
                    }
                });
                resizeObserver.observe(container);
                log('ResizeObserver attached');
            })
            .catch((err) => {
                log(`IMPORT FAILED: ${String(err)}`);
                console.error('Failed to load map:', err);
                setError('Could not load the map. Please try again.');
            });

        return () => {
            cancelled = true;
            resizeObserver?.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show]);

    useEffect(() => {
        if (show) return;
        mapRef.current?.remove();
        mapRef.current = null;
        markerRef.current = null;
        if (show === false) log('modal closed, map torn down');
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
        });
    }

    function handleUseLocation() {
        if (!lat || !lng) {
            setError('Pick a point on the map or enter coordinates first.');
            return;
        }
        onSelect(`${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`);
        onClose();
    }

    return (
        <Modal show={show} onClose={onClose} maxWidth="2xl">
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
                            onChange={(e) => setLng(e.target.value)}
                        />
                    </div>
                    <div className="flex items-end">
                        <Button type="button" variant="secondary" onClick={handleZoomToCoordinates}>
                            Zoom
                        </Button>
                    </div>
                </div>

                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

                <div
                    ref={mapContainerRef}
                    className="mt-4 h-80 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
                />

                {/* DEBUG PANEL — remove once diagnosed */}
                <div className="mt-3 max-h-40 overflow-y-auto rounded-md border border-amber-300 bg-amber-50 p-2 font-mono text-[10px] leading-tight text-amber-900">
                    <p className="mb-1 font-bold">DEBUG LOG:</p>
                    {debugLog.length === 0 && <p>waiting for effect to fire...</p>}
                    {debugLog.map((line, i) => (
                        <p key={i}>{line}</p>
                    ))}
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleUseLocation}>
                        Use These Coordinates
                    </Button>
                </div>
            </div>
        </Modal>
    );
}