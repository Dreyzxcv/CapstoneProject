import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, TileLayer } from 'leaflet';
import { MapPin, Maximize2, Minimize2, Loader2, Satellite, Map as MapIcon } from 'lucide-react';
import { router } from '@inertiajs/react';

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
    asset_ids: number[];
    asset_types: string[];
}

const TYPE_COLORS: Record<string, string> = {
    log: '#34d399',
    equipment: '#fbbf24',
    vehicle: '#60a5fa',
};
const MIXED_COLOR = '#c084fc';
const FALLBACK_COLOR: string = '#f87171';

type MapView = 'normal' | 'satellite';

function markerColor(types: string[]): string {
    if (types.length === 0) return FALLBACK_COLOR;
    if (types.length === 1) return TYPE_COLORS[types[0]] ?? FALLBACK_COLOR;
    return MIXED_COLOR;
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
    const normalLayerRef = useRef<TileLayer | null>(null);
    const satelliteLayerRef = useRef<TileLayer | null>(null);
    const satelliteLabelsRef = useRef<TileLayer | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [mapView, setMapView] = useState<MapView>('satellite');

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
                scrollWheelZoom: true,
                zoomControl: false,
                attributionControl: false,
                fadeAnimation: true,
                zoomAnimation: true,
            });

            // Normal (street/labels) basemap — OpenStreetMap, clean and readable.
            const normalLayer = L.tileLayer(
                'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                {
                    subdomains: 'abc',
                    maxZoom: 19,
                },
            );

            // Satellite basemap
            const satelliteLayer = L.tileLayer(
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                {
                    maxZoom: 19,
                },
            );

            // Labels overlay shown only on top of satellite imagery so place
            // names/roads stay legible — matches Google Maps' hybrid view.
            const satelliteLabels = L.tileLayer(
                'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
                {
                    maxZoom: 19,
                    opacity: 0.9,
                },
            );

            normalLayerRef.current = normalLayer;
            satelliteLayerRef.current = satelliteLayer;
            satelliteLabelsRef.current = satelliteLabels;

            // Start with satellite (matches current default); the effect
            // below keeps this in sync if mapView changes.
            satelliteLayer.addTo(map);
            satelliteLabels.addTo(map);

            L.control.zoom({ position: 'bottomright' }).addTo(map);
            L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

            const latLngs: [number, number][] = [];

            plottable.forEach(({ incident, point }) => {
                latLngs.push([point.lat, point.lng]);

                const dotColor = markerColor(incident.asset_types);

                const icon = L.divIcon({
                    className: '',
                    html: `<span class="incident-pulse-dot${incident.is_abandoned ? ' is-abandoned' : ''}" style="--dot-color:${dotColor}"></span>`,
                    iconSize: [16, 16],
                    iconAnchor: [8, 8],
                });

                const dateLabel = incident.date_of_apprehension
                    ? new Date(incident.date_of_apprehension).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Date not on file';

                const primaryAssetId = incident.asset_ids[0];
                const viewButtonId = `incident-view-${incident.id}`;

                const marker = L.marker([point.lat, point.lng], { icon })
                    .addTo(map)
                    .bindPopup(
                        `<div class="incident-popup">
                            <div class="incident-popup-band" style="background:${dotColor}"></div>
                            <div class="incident-popup-body">
                                <p class="incident-popup-code">${incident.incident_code}</p>
                                <p class="incident-popup-place">${incident.place_of_apprehension}</p>
                                <div class="incident-popup-meta">
                                    <span>${dateLabel}</span>
                                    <span class="incident-popup-dot">&middot;</span>
                                    <span>${incident.asset_count} asset${incident.asset_count === 1 ? '' : 's'}</span>
                                </div>
                                ${incident.is_abandoned ? '<span class="incident-popup-badge">Abandoned</span>' : ''}
                                ${
                                    primaryAssetId
                                        ? `<button id="${viewButtonId}" class="incident-popup-button">
                                            View Asset${incident.asset_count > 1 ? 's' : ''} →
                                        </button>`
                                        : ''
                                }
                            </div>
                        </div>`,
                        { className: 'incident-popup-wrapper', closeButton: true },
                    );

                // Leaflet popups render outside React's tree, so the button has to be
                // wired up imperatively each time the popup opens (the DOM node is
                // recreated on every open).
                if (primaryAssetId) {
                    marker.on('popupopen', () => {
                        document
                            .getElementById(viewButtonId)
                            ?.addEventListener('click', () => {
                                router.visit(route('assets.show', primaryAssetId));
                            });
                    });
                }
            });

            if (latLngs.length > 0) {
                map.fitBounds(latLngs, { padding: [32, 32], maxZoom: 14 });
            } else {
                map.fitBounds(CATANDUANES_BOUNDS);
            }

            mapRef.current = map;
            setIsLoading(false);
        });

        return () => {
            cancelled = true;
            mapRef.current?.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Swap basemap layers whenever the toggle changes, without tearing down
    // the whole map (markers, view position, etc. stay intact).
    useEffect(() => {
        const map = mapRef.current;
        const normalLayer = normalLayerRef.current;
        const satelliteLayer = satelliteLayerRef.current;
        const satelliteLabels = satelliteLabelsRef.current;
        if (!map || !normalLayer || !satelliteLayer || !satelliteLabels) return;

        if (mapView === 'normal') {
            map.removeLayer(satelliteLayer);
            map.removeLayer(satelliteLabels);
            if (!map.hasLayer(normalLayer)) normalLayer.addTo(map);
        } else {
            map.removeLayer(normalLayer);
            if (!map.hasLayer(satelliteLayer)) satelliteLayer.addTo(map);
            if (!map.hasLayer(satelliteLabels)) satelliteLabels.addTo(map);
        }
    }, [mapView]);

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
        setIsFullscreen((prev) => !prev);
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
            <div className="flex h-96 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gradient-to-b from-gray-50 to-white text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                    <MapPin className="h-6 w-6 text-gray-300" />
                </span>
                <p className="text-sm font-medium text-gray-500">
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
                    background: var(--dot-color, #f87171);
                    border: 2.5px solid #ffffff;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.5), 0 0 0 rgba(0,0,0,0.35);
                    animation: incident-pulse 2s ease-out infinite;
                    cursor: pointer;
                    transition: transform 0.15s ease;
                }
                .incident-pulse-dot:hover {
                    transform: scale(1.25);
                }
                .incident-pulse-dot.is-abandoned {
                    border: 2.5px dashed #111827;
                }
                @keyframes incident-pulse {
                    0% { box-shadow: 0 1px 4px rgba(0,0,0,0.5), 0 0 0 0 rgba(255,255,255,0.5); }
                    70% { box-shadow: 0 1px 4px rgba(0,0,0,0.5), 0 0 0 12px rgba(255,255,255,0); }
                    100% { box-shadow: 0 1px 4px rgba(0,0,0,0.5), 0 0 0 0 rgba(255,255,255,0); }
                }

                .incident-popup-wrapper .leaflet-popup-content-wrapper {
                    padding: 0;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 10px 30px -6px rgba(0,0,0,0.35);
                }
                .incident-popup-wrapper .leaflet-popup-content {
                    margin: 0;
                    width: 220px !important;
                }
                .incident-popup-wrapper .leaflet-popup-tip {
                    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
                }
                .incident-popup-band {
                    height: 5px;
                    width: 100%;
                }
                .incident-popup-body {
                    padding: 12px 14px 14px;
                    font-family: inherit;
                }
                .incident-popup-code {
                    margin: 0;
                    font-size: 13px;
                    font-weight: 700;
                    color: #111827;
                }
                .incident-popup-place {
                    margin: 2px 0 0;
                    font-size: 12px;
                    color: #4b5563;
                    line-height: 1.4;
                }
                .incident-popup-meta {
                    margin-top: 6px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 11px;
                    color: #9ca3af;
                }
                .incident-popup-dot { color: #d1d5db; }
                .incident-popup-badge {
                    display: inline-block;
                    margin-top: 6px;
                    padding: 1px 8px;
                    border-radius: 9999px;
                    background: #f3f4f6;
                    color: #374151;
                    font-size: 10px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }
                .incident-popup-button {
                    margin-top: 10px;
                    width: 100%;
                    padding: 6px 10px;
                    font-size: 11.5px;
                    font-weight: 600;
                    color: #fff;
                    background: #047857;
                    border: none;
                    border-radius: 7px;
                    cursor: pointer;
                    transition: background 0.15s ease;
                }
                .incident-popup-button:hover {
                    background: #065f46;
                }

                .incident-map-shell .leaflet-control-zoom a {
                    border-radius: 8px !important;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
                }
                .incident-map-shell .leaflet-control-attribution {
                    font-size: 9px;
                    background: rgba(255,255,255,0.7);
                    padding: 1px 4px;
                    opacity: 0.6;
                }
                .incident-map-shell .leaflet-control-attribution:hover {
                    opacity: 1;
                }
            `}</style>

            {/* Backdrop behind the fullscreen map */}
            {isFullscreen && (
                <div className="fixed inset-0 z-[9998] bg-gray-900/60 backdrop-blur-sm" onClick={toggleFullscreen} />
            )}

            <div
                className={
                    'incident-map-shell isolate ' +
                    (isFullscreen
                        ? 'fixed inset-4 z-[9999] overflow-hidden rounded-xl border border-gray-200 shadow-2xl sm:inset-8'
                        : 'relative h-96 w-full overflow-hidden rounded-xl border border-gray-200 shadow-sm')
                }
            >
                {isLoading && (
                    <div className="absolute inset-0 z-[500] flex items-center justify-center gap-2 bg-gray-900 text-sm text-gray-300">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading map…
                    </div>
                )}

                <div ref={containerRef} className="h-full w-full" />

                {/* Map view toggle: Normal vs Satellite */}
                <div className="absolute left-3 top-3 z-[1000] flex items-center rounded-lg bg-white/95 p-1 shadow-md ring-1 ring-black/5 backdrop-blur-sm">
                    <button
                        type="button"
                        onClick={() => setMapView('normal')}
                        className={
                            'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ' +
                            (mapView === 'normal'
                                ? 'bg-emerald-700 text-white'
                                : 'text-gray-600 hover:bg-gray-100')
                        }
                    >
                        <MapIcon className="h-3.5 w-3.5" />
                        Normal
                    </button>
                    <button
                        type="button"
                        onClick={() => setMapView('satellite')}
                        className={
                            'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ' +
                            (mapView === 'satellite'
                                ? 'bg-emerald-700 text-white'
                                : 'text-gray-600 hover:bg-gray-100')
                        }
                    >
                        <Satellite className="h-3.5 w-3.5" />
                        Satellite
                    </button>
                </div>

                <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="absolute right-3 top-3 z-[1000] flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-md ring-1 ring-black/5 backdrop-blur-sm transition hover:bg-white"
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

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5 text-xs text-gray-600">
                <span className="font-semibold text-gray-500">Asset type:</span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: '#34d399' }} />
                    Log / Lumber
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: '#fbbf24' }} />
                    Equipment / Tools
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: '#60a5fa' }} />
                    Conveyance / Vehicle
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: '#c084fc' }} />
                    Mixed
                </span>

                <span className="ml-2 font-semibold text-gray-500">Status:</span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-gray-400 shadow-sm" />
                    Apprehended
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-gray-900 bg-gray-400" />
                    Abandoned
                </span>
            </div>
        </>
    );
}