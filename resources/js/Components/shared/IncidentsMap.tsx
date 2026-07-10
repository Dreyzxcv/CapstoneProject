import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { MapPin, Maximize2, Minimize2 } from 'lucide-react';

// Same bounding box used by CoordinatesPickerModal, so the two stay visually consistent.
const CATANDUANES_BOUNDS: [[number, number], [number, number]] = [
    [13.40, 124.05],
    [14.10, 124.45],
];
const CATANDUANES_CENTER: [number, number] = [13.75, 124.24];

export interface IncidentLocation {
    id: number;
    incident_code: string;
    coordinates: string;
    place_of_apprehension: string;
    date_of_apprehension: string | null;
    is_abandoned: boolean;
    asset_count: number;
}

function parseCoordinates(value: string): { lat: number; lng: number } | null {
    const match = value.match(/(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)/);
    if (!match) return null;
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[3]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
}

export function IncidentsMap({ incidents }: { incidents: IncidentLocation[] }) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const plottable = incidents
        .map((incident) => ({ incident, point: parseCoordinates(incident.coordinates) }))
        .filter((row): row is { incident: IncidentLocation; point: { lat: number; lng: number } } => row.point !== null);

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        let cancelled = false;

        import('leaflet').then((L) => {
            if (cancelled || !containerRef.current || mapRef.current) return;

            // Fix Leaflet's default marker icons breaking under Vite bundling
            // (matches the workaround already used in CoordinatesPickerModal).
            delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

            const map = L.map(containerRef.current, {
                center: CATANDUANES_CENTER,
                zoom: 10,
                minZoom: 9,
                maxZoom: 17,
                maxBounds: CATANDUANES_BOUNDS,
                maxBoundsViscosity: 1.0,
                scrollWheelZoom: false,
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors',
            }).addTo(map);

            const latLngs: [number, number][] = [];

            plottable.forEach(({ incident, point }) => {
                latLngs.push([point.lat, point.lng]);

                const icon = L.divIcon({
                    className: '',
                    html: '<span class="incident-pulse-dot"></span>',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8],
                });

                const dateLabel = incident.date_of_apprehension
                    ? new Date(incident.date_of_apprehension).toLocaleDateString()
                    : 'Date not on file';

                L.marker([point.lat, point.lng], { icon })
                    .addTo(map)
                    .bindPopup(
                        `<div style="font-size:12px;line-height:1.5">
                            <strong>${incident.incident_code}</strong><br/>
                            ${incident.place_of_apprehension}<br/>
                            ${dateLabel} &middot; ${incident.asset_count} asset(s)
                            ${incident.is_abandoned ? '<br/><em>Abandoned</em>' : ''}
                        </div>`,
                    );
            });

            if (latLngs.length > 0) {
                map.fitBounds(latLngs, { padding: [28, 28], maxZoom: 14 });
            } else {
                map.fitBounds(CATANDUANES_BOUNDS);
            }

            mapRef.current = map;
        });

        return () => {
            cancelled = true;
            mapRef.current?.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Leaflet measures its container on init/resize, but it has no way to
    // know we've just changed the container's CSS position/size via the
    // fullscreen toggle below, so we have to explicitly nudge it.
    const refreshMapSize = useCallback(() => {
        // Wait a tick for the fullscreen layout change (fixed positioning,
        // new width/height) to actually apply to the DOM before Leaflet
        // re-measures, otherwise it captures the pre-toggle dimensions.
        requestAnimationFrame(() => {
            mapRef.current?.invalidateSize();
        });
    }, []);

    const toggleFullscreen = useCallback(() => {
        setIsFullscreen((prev) => {
            const next = !prev;
            return next;
        });
    }, []);

    useEffect(() => {
        refreshMapSize();

        if (!isFullscreen) return;

        // Prevent the page behind the fullscreen map from scrolling.
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                setIsFullscreen(false);
            }
        }

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isFullscreen, refreshMapSize]);

    if (plottable.length === 0) {
        return (
            <div className="flex h-80 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 text-center">
                <MapPin className="h-6 w-6 text-gray-300" />
                <p className="text-sm text-gray-500">
                    No incidents with coordinates on file yet.
                </p>
                <p className="max-w-xs text-xs text-gray-400">
                    Locations appear here once MES logs coordinates during incident intake.
                </p>
            </div>
        );
    }

    return (
        <>
            <style>{`
                .incident-pulse-dot {
                    display: block;
                    width: 14px;
                    height: 14px;
                    border-radius: 9999px;
                    background: #dc2626;
                    border: 2px solid #ffffff;
                    box-shadow: 0 0 0 rgba(220, 38, 38, 0.6);
                    animation: incident-pulse 1.6s ease-out infinite;
                }
                @keyframes incident-pulse {
                    0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.55); }
                    70% { box-shadow: 0 0 0 14px rgba(220, 38, 38, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
                }
            `}</style>

            {/* Backdrop behind the fullscreen map */}
            {isFullscreen && (
                <div className="fixed inset-0 z-[9998] bg-gray-900/60" onClick={toggleFullscreen} />
            )}

            <div
                className={
                    isFullscreen
                        ? 'fixed inset-4 z-[9999] overflow-hidden rounded-lg border border-gray-200 shadow-2xl sm:inset-8'
                        : 'relative h-80 w-full overflow-hidden rounded-lg border border-gray-200'
                }
            >
                <div ref={containerRef} className="h-full w-full" />

                <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="absolute right-3 top-3 z-[1000] flex items-center gap-1.5 rounded-md bg-white/95 px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-md ring-1 ring-black/5 transition hover:bg-white"
                    aria-label={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
                >
                    {isFullscreen ? (
                        <>
                            <Minimize2 className="h-3.5 w-3.5" />
                            Exit Fullscreen
                        </>
                    ) : (
                        <>
                            <Maximize2 className="h-3.5 w-3.5" />
                            Fullscreen
                        </>
                    )}
                </button>
            </div>
        </>
    );
}