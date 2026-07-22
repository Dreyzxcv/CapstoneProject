// resources/js/Components/shared/IncidentLocationMap.tsx
import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { MapPin } from 'lucide-react';

interface IncidentLocationMapProps {
    coordinates: string | null | undefined;
    placeName?: string | null;
    areaName?: string | null;
}

function parseCoordinates(value?: string | null): { lat: number; lng: number } | null {
    if (!value) return null;
    const match = value.match(/(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)/);
    if (!match) return null;
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[3]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
}

export function IncidentLocationMap({ coordinates, placeName, areaName }: IncidentLocationMapProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const [error, setError] = useState<string | null>(null);

    const parsed = parseCoordinates(coordinates);

    useEffect(() => {
        if (!parsed || !mapContainerRef.current || mapRef.current) return;

        let cancelled = false;

        import('leaflet')
            .then((L) => {
                if (cancelled || !mapContainerRef.current || mapRef.current) return;

                delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
                L.Icon.Default.mergeOptions({
                    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                });

                const map = L.map(mapContainerRef.current, {
                    center: [parsed.lat, parsed.lng],
                    zoom: 15,
                    scrollWheelZoom: false,
                    dragging: true,
                });

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors',
                }).addTo(map);

                const marker = L.marker([parsed.lat, parsed.lng]).addTo(map);
                if (placeName) {
                    marker.bindPopup(placeName).openPopup();
                }

                mapRef.current = map;
            })
            .catch(() => setError('Could not load the map.'));

        return () => {
            cancelled = true;
            mapRef.current?.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [coordinates]);

    if (!parsed) return null;

    return (
        <div className="space-y-2">
            {(placeName || areaName) && (
                <p className="flex items-center gap-1.5 text-sm text-gray-600">
                    <MapPin className="h-3.5 w-3.5 text-emerald-700" />
                    {placeName}
                    {areaName ? ` — ${areaName}` : ''}
                </p>
            )}
            {error ? (
                <p className="text-sm text-red-600">{error}</p>
            ) : (
                <div
                    ref={mapContainerRef}
                    className="relative isolate z-0 h-64 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
                />
            )}
        </div>
    );
}