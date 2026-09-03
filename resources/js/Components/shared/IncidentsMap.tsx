import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, TileLayer, Marker as LeafletMarker } from 'leaflet';
import { MapPin, Maximize2, Minimize2, Loader2, Satellite, Map as MapIcon } from 'lucide-react';
import { router } from '@inertiajs/react';

const CATANDUANES_BOUNDS: [[number, number], [number, number]] = [
    [13.35, 124.00],
    [14.15, 124.50],
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
    const leafletModuleRef = useRef<typeof import('leaflet') | null>(null);
    const markersRef = useRef<LeafletMarker[]>([]);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [mapView, setMapView] = useState<MapView>('satellite');
    const [mapReady, setMapReady] = useState(false);

    const plottable = incidents
        .map((incident) => ({ incident, point: parseCoordinates(incident.coordinates) }))
        .filter((row): row is { incident: IncidentLocation; point: { lat: number; lng: number } } => row.point !== null);

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        let cancelled = false;

        import('leaflet').then((L) => {
            if (cancelled || !containerRef.current || mapRef.current) return;

            leafletModuleRef.current = L;

            delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;

            const map = L.map(containerRef.current, {
                center: CATANDUANES_CENTER,
                zoom: 10,
                minZoom: 9,
                maxZoom: 19,
                maxBounds: CATANDUANES_BOUNDS,
                maxBoundsViscosity: 1.0,
                scrollWheelZoom: true,
                zoomControl: false,
                attributionControl: false,
                fadeAnimation: true,
                zoomAnimation: true,
            });

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

            map.fitBounds(CATANDUANES_BOUNDS);

            mapRef.current = map;
            setIsLoading(false);
            setMapReady(true);
        });

        return () => {
            cancelled = true;
            mapRef.current?.remove();
            mapRef.current = null;
            leafletModuleRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Marker sync — re-runs whenever the incidents list changes (i.e. the
    // month/year filter changes), clearing previously drawn markers and
    // plotting the new set on the existing map instance. This is what was
    // missing before: markers were only ever added once, inside the
    // map-creation effect, so changing the `incidents` prop never updated
    // what was drawn.
    useEffect(() => {
        const map = mapRef.current;
        const L = leafletModuleRef.current;
        if (!map || !L || !mapReady) return;

        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current = [];

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
                        <div class="incident-popup-hero" style="background:${dotColor}18; border-bottom: 1px solid ${dotColor}30;">
                            <div class="incident-popup-accent" style="background:${dotColor}"></div>
                            <div class="incident-popup-hero-content">
                                <div class="incident-popup-icon" style="background:${dotColor}22; color:${dotColor}">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                                </div>
                                <div>
                                    <p class="incident-popup-code">${incident.incident_code}</p>
                                    ${incident.is_abandoned ? `<span class="incident-popup-badge-abandoned">Abandoned</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="incident-popup-body">
                            <div class="incident-popup-place-row">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
                                <span class="incident-popup-place">${incident.place_of_apprehension}</span>
                            </div>
                            <div class="incident-popup-stats">
                                <div class="incident-popup-stat">
                                    <span class="incident-popup-stat-value">${incident.asset_count}</span>
                                    <span class="incident-popup-stat-label">Asset${incident.asset_count === 1 ? '' : 's'}</span>
                                </div>
                                <div class="incident-popup-stat-divider"></div>
                                <div class="incident-popup-stat">
                                    <span class="incident-popup-stat-value">${dateLabel.split(' ')[2] ?? '—'}</span>
                                    <span class="incident-popup-stat-label">${dateLabel !== 'Date not on file' ? dateLabel.split(' ').slice(0,2).join(' ') : 'No date'}</span>
                                </div>
                            </div>
                            ${
                                primaryAssetId
                                    ? `<button id="${viewButtonId}" class="incident-popup-button" style="--btn-color:${dotColor}">
                                        <span>View Asset${incident.asset_count > 1 ? 's' : ''}</span>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
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
                            router.visit(route('assets.index', { incident_id: incident.id }));
                        });
                });
            }

            markersRef.current.push(marker);
        });

        if (latLngs.length > 0) {
            map.fitBounds(latLngs, { padding: [32, 32], maxZoom: 14 });
        }
        // When latLngs is empty (filter matched nothing), deliberately leave
        // the current view alone instead of snapping back to the full
        // Catanduanes bounds — less jarring than the view jumping around
        // every time a filter briefly has zero results.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [incidents, mapReady]);

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
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 20px 40px -8px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.06);
                }
                .incident-popup-wrapper .leaflet-popup-content {
                    margin: 0;
                    width: 240px !important;
                }
                .incident-popup-wrapper .leaflet-popup-tip-container {
                    margin-top: -1px;
                }
                .incident-popup-wrapper .leaflet-popup-tip {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                }
                .incident-popup-wrapper .leaflet-popup-close-button {
                    top: 8px !important;
                    right: 10px !important;
                    width: 20px !important;
                    height: 20px !important;
                    font-size: 16px !important;
                    color: rgba(0,0,0,0.35) !important;
                    font-weight: 300 !important;
                    line-height: 20px !important;
                    z-index: 10;
                }
                .incident-popup-wrapper .leaflet-popup-close-button:hover {
                    color: #111827 !important;
                }
                .incident-popup {
                    font-family: inherit;
                    background: #ffffff;
                }
                .incident-popup-hero {
                    position: relative;
                    padding: 14px 14px 12px;
                    overflow: hidden;
                }
                .incident-popup-accent {
                    position: absolute;
                    left: 0; top: 0; bottom: 0;
                    width: 4px;
                }
                .incident-popup-hero-content {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding-left: 8px;
                }
                .incident-popup-icon {
                    flex-shrink: 0;
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .incident-popup-code {
                    margin: 0;
                    font-size: 13.5px;
                    font-weight: 700;
                    color: #0f172a;
                    letter-spacing: -0.01em;
                }
                .incident-popup-badge-abandoned {
                    display: inline-block;
                    margin-top: 3px;
                    padding: 1px 7px;
                    border-radius: 9999px;
                    background: #fef3c7;
                    color: #92400e;
                    font-size: 9.5px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    border: 1px solid #fde68a;
                }
                .incident-popup-body {
                    padding: 10px 14px 14px;
                }
                .incident-popup-place-row {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    margin-bottom: 10px;
                }
                .incident-popup-place {
                    font-size: 11.5px;
                    color: #6b7280;
                    line-height: 1.4;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .incident-popup-stats {
                    display: flex;
                    align-items: center;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    overflow: hidden;
                    margin-bottom: 12px;
                }
                .incident-popup-stat {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 8px 6px;
                    gap: 2px;
                }
                .incident-popup-stat-divider {
                    width: 1px;
                    height: 28px;
                    background: #e2e8f0;
                    flex-shrink: 0;
                }
                .incident-popup-stat-value {
                    font-size: 15px;
                    font-weight: 700;
                    color: #0f172a;
                    line-height: 1;
                }
                .incident-popup-stat-label {
                    font-size: 9.5px;
                    color: #94a3b8;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }
                .incident-popup-button {
                    width: 100%;
                    padding: 8px 12px;
                    font-size: 12px;
                    font-weight: 600;
                    color: #fff;
                    background: var(--btn-color, #047857);
                    border: none;
                    border-radius: 9px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    transition: opacity 0.15s ease, transform 0.1s ease;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.18);
                    font-family: inherit;
                }
                .incident-popup-button:hover {
                    opacity: 0.88;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.22);
                }
                .incident-popup-button:active {
                    transform: translateY(0);
                    opacity: 1;
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

                {!isLoading && plottable.length === 0 && (
                    <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center gap-2 bg-white/90 px-6 text-center backdrop-blur-sm">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                            <MapPin className="h-6 w-6 text-gray-300" />
                        </span>
                        <p className="text-sm font-medium text-gray-500">
                            No incidents with coordinates for this filter.
                        </p>
                        <p className="max-w-xs text-xs text-gray-400">
                            Try a different month or year, or clear the filter to see everything.
                        </p>
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