import React, { Component, memo, useEffect, useMemo, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './TrackerMap.css';

function safeNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function fmtSpeed(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `${Math.round(Number(v) * 3.6)} km/h`;
}

function fmtAlt(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `${Math.round(Number(v)).toLocaleString()} m`;
}

/* ─── Aircraft divIcon ─────────────────────────────────────────── */
function buildAircraftIcon({ item = {}, zoom = 4, selected = false }) {
  const heading = safeNumber(item.trueTrack, 0);
  const onGround = !!item.onGround;
  const size = selected ? 58 : Math.max(36, Math.min(50, 28 + zoom * 2.4));
  const fill = onGround ? '#94a3b8' : selected ? '#4ade80' : '#38bdf8';
  const strokeColor = '#0a1520';
  const label = String(item.callsign || item.icao24 || '').trim().replace(/"/g, '&quot;');
  const classes = [
    'ac-marker',
    onGround ? 'is-ground' : 'is-airborne',
    selected ? 'is-selected' : '',
  ].filter(Boolean).join(' ');

  return L.divIcon({
    className: 'ac-marker-host',
    html: `
      <div class="${classes}" aria-label="${label}" style="width:${size}px;height:${size}px;">
        <svg
          viewBox="0 0 40 40"
          width="${size}"
          height="${size}"
          style="transform:rotate(${heading}deg);overflow:visible;display:block;"
        >
          <!-- Fuselage -->
          <ellipse cx="20" cy="17" rx="2.3" ry="12.5" fill="${fill}" stroke="${strokeColor}" stroke-width="0.8"/>
          <!-- Main wings (swept) -->
          <path d="M20 14 L36 22 L34 24 L20 20 L6 24 L4 22 Z" fill="${fill}" stroke="${strokeColor}" stroke-width="0.8"/>
          <!-- Horizontal stabilizer -->
          <path d="M20 27 L26.5 31 L25.5 32.5 L20 30.5 L14.5 32.5 L13.5 31 Z" fill="${fill}" stroke="${strokeColor}" stroke-width="0.8"/>
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 8)],
  });
}

/* ─── Cluster divIcon ──────────────────────────────────────────── */
function buildClusterIcon(count) {
  const s = count > 50 ? 46 : count > 20 ? 40 : count > 8 ? 36 : 32;
  return L.divIcon({
    className: 'ac-cluster-host',
    html: `<div class="ac-cluster" style="width:${s}px;height:${s}px;">${count > 99 ? '99+' : count}</div>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
  });
}

/* ─── Airport divIcon ──────────────────────────────────────────── */
function buildAirportIcon() {
  return L.divIcon({
    className: 'ac-airport-host',
    html: `
      <div class="ac-airport-marker">
        <svg viewBox="0 0 24 24" width="26" height="26">
          <circle cx="12" cy="12" r="4.5" fill="rgba(14,165,233,0.92)" stroke="#e0f2fe" stroke-width="1.5"/>
          <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(14,165,233,0.28)" stroke-width="1"/>
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

/* ─── Popup content ────────────────────────────────────────────── */
const AircraftPopup = memo(function AircraftPopup({ aircraft }) {
  return (
    <div className="ac-popup">
      <div className="ac-popup-callsign">{aircraft.callsign || aircraft.icao24}</div>
      {aircraft.originCountry && (
        <div className="ac-popup-country">{aircraft.originCountry}</div>
      )}
      <div className="ac-popup-data">
        {fmtAlt(aircraft.geoAltitude ?? aircraft.baroAltitude) !== '—' && (
          <span className="ac-popup-pill">{fmtAlt(aircraft.geoAltitude ?? aircraft.baroAltitude)}</span>
        )}
        {fmtSpeed(aircraft.velocity) !== '—' && (
          <span className="ac-popup-pill">{fmtSpeed(aircraft.velocity)}</span>
        )}
        {Number.isFinite(Number(aircraft.trueTrack)) && (
          <span className="ac-popup-pill">{Math.round(Number(aircraft.trueTrack))}°</span>
        )}
        <span className="ac-popup-pill">{aircraft.onGround ? 'Ground' : 'Airborne'}</span>
      </div>
    </div>
  );
});

/* ─── Auto-focus selected aircraft ────────────────────────────── */
function FocusSelectedAircraft({ aircraft }) {
  const map = useMap();
  useEffect(() => {
    if (!aircraft || aircraft.latitude == null || aircraft.longitude == null) return;
    map.flyTo([aircraft.latitude, aircraft.longitude], Math.max(map.getZoom(), 7), {
      animate: true,
      duration: 1.1,
      easeLinearity: 0.28,
    });
  }, [aircraft, map]);
  return null;
}

/* ─── Keep map sized to its container ─────────────────────────── */
function SyncMapSize() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    let frame;
    const invalidate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => map.invalidateSize({ animate: false }));
    };
    invalidate();
    const container = map.getContainer?.();
    const ro = typeof ResizeObserver !== 'undefined' && container ? new ResizeObserver(invalidate) : null;
    ro?.observe(container);
    window.addEventListener('resize', invalidate);
    const t = setTimeout(invalidate, 160);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(t);
      window.removeEventListener('resize', invalidate);
      ro?.disconnect();
    };
  }, [map]);
  return null;
}

/* ─── Normalise aircraft point ────────────────────────────────── */
function normalizePoint(item) {
  const lat = safeNumber(item.latitude, null);
  const lon = safeNumber(item.longitude, null);
  if (lat === null || lon === null) return null;
  return { ...item, latitude: lat, longitude: lon };
}

function haversineKm(a, b) {
  const lat1 = safeNumber(a?.latitude, null);
  const lon1 = safeNumber(a?.longitude, null);
  const lat2 = safeNumber(b?.latitude, null);
  const lon2 = safeNumber(b?.longitude, null);
  if ([lat1, lon1, lat2, lon2].some(v => v === null)) return null;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}

function projectOnRoute(from, to, aircraft) {
  const fLat = safeNumber(from?.latitude, null);
  const fLon = safeNumber(from?.longitude, null);
  const tLat = safeNumber(to?.latitude, null);
  const tLon = safeNumber(to?.longitude, null);
  const aLat = safeNumber(aircraft?.latitude, null);
  const aLon = safeNumber(aircraft?.longitude, null);
  if ([fLat, fLon, tLat, tLon, aLat, aLon].some(v => v === null)) return null;

  const latRef = ((fLat + tLat) / 2) * Math.PI / 180;
  const fx = fLon * Math.cos(latRef);
  const fy = fLat;
  const tx = tLon * Math.cos(latRef);
  const ty = tLat;
  const ax = aLon * Math.cos(latRef);
  const ay = aLat;
  const dx = tx - fx;
  const dy = ty - fy;
  const lenSq = dx * dx + dy * dy;
  if (!lenSq) return null;

  const rawT = ((ax - fx) * dx + (ay - fy) * dy) / lenSq;
  const t = Math.max(0, Math.min(1, rawT));
  const projection = {
    latitude: fy + dy * t,
    longitude: (fx + dx * t) / Math.cos(latRef),
  };
  const totalKm = haversineKm(from, to);
  const offRouteKm = haversineKm(aircraft, projection);
  const reliable =
    totalKm != null &&
    offRouteKm != null &&
    rawT >= -0.08 &&
    rawT <= 1.08 &&
    offRouteKm <= Math.max(45, totalKm * 0.12);

  return { reliable, projection };
}

/* ─── Clustered aircraft layer ─────────────────────────────────── */
function ClusteredAircraftLayer({ aircraft = [], zoom = 4, selectedAircraftId = null, onSelectAircraft }) {
  const map = useMap();
  const [mapZoom, setMapZoom] = useState(zoom);

  useMapEvents({
    zoomend() { setMapZoom(map.getZoom()); },
  });
  useEffect(() => { setMapZoom(map.getZoom()); }, [map]);

  const points = useMemo(() => aircraft.map(normalizePoint).filter(Boolean), [aircraft]);
  const selectedKey = String(selectedAircraftId || '');

  const layers = useMemo(() => {
    const cluster = mapZoom < 8;
    if (!cluster) {
      return points
        .filter(item => !selectedKey || String(item.icao24) !== selectedKey)
        .map(item => ({ type: 'aircraft', key: String(item.icao24), item }));
    }

    const gridSize = mapZoom < 3 ? 110 : mapZoom < 5 ? 80 : mapZoom < 7 ? 56 : 38;
    const groups = new Map();

    points.forEach(item => {
      if (selectedKey && String(item.icao24) === selectedKey) return;
      const pt = map.project([item.latitude, item.longitude], mapZoom);
      const key = `${Math.floor(pt.x / gridSize)}:${Math.floor(pt.y / gridSize)}`;
      const g = groups.get(key) || { items: [], sx: 0, sy: 0 };
      g.items.push(item);
      g.sx += pt.x;
      g.sy += pt.y;
      groups.set(key, g);
    });

    const result = [];
    groups.forEach((g, key) => {
      const n = g.items.length;
      if (n === 1) {
        result.push({ type: 'aircraft', key, item: g.items[0] });
      } else {
        const mid = map.unproject([g.sx / n, g.sy / n], mapZoom);
        result.push({ type: 'cluster', key, count: n, lat: mid.lat, lng: mid.lng, items: g.items });
      }
    });
    return result;
  }, [map, mapZoom, points, selectedKey]);

  return (
    <>
      {layers.map(entry => {
        if (entry.type === 'cluster') {
          return (
            <Marker
              key={entry.key}
              position={[entry.lat, entry.lng]}
              icon={buildClusterIcon(entry.count)}
              eventHandlers={{
                click: () => {
                  map.flyTo([entry.lat, entry.lng], Math.min(mapZoom + 3, 12), { animate: true, duration: 0.85 });
                  if (entry.items?.[0]) onSelectAircraft?.(entry.items[0]);
                },
              }}
            >
              <Popup>
                <div className="ac-popup">
                  <div className="ac-popup-callsign">{entry.count} aircraft</div>
                  <div className="ac-popup-country">Zoom in to see individual flights</div>
                </div>
              </Popup>
            </Marker>
          );
        }

        const { item } = entry;
        const isSelected = !!selectedKey && String(item.icao24) === selectedKey;
        return (
          <Marker
            key={item.icao24}
            position={[item.latitude, item.longitude]}
            icon={buildAircraftIcon({ item, zoom: mapZoom, selected: isSelected })}
            zIndexOffset={isSelected ? 1500 : item.onGround ? 200 : 600}
            eventHandlers={{ click: () => onSelectAircraft?.(item) }}
          >
            <Popup><AircraftPopup aircraft={item} /></Popup>
          </Marker>
        );
      })}
    </>
  );
}

/* ─── FR24 actual track path ───────────────────────────────────── */
function TrackLayer({ trackPoints = [] }) {
  const positions = useMemo(
    () =>
      trackPoints
        .filter(p => Number.isFinite(safeNumber(p.latitude)) && Number.isFinite(safeNumber(p.longitude)))
        .map(p => [safeNumber(p.latitude), safeNumber(p.longitude)]),
    [trackPoints]
  );
  if (positions.length < 2) return null;
  return (
    <Polyline
      positions={positions}
      pathOptions={{ color: '#4ade80', weight: 2.5, opacity: 0.88, lineCap: 'round', lineJoin: 'round' }}
    />
  );
}

/* ─── Route line + airport pins ───────────────────────────────── */
function RouteLayer({ route, hasTrack = false, selectedAircraft = null }) {
  const from = route?.from;
  const to = route?.to;
  const fLat = safeNumber(from?.latitude, null);
  const fLon = safeNumber(from?.longitude, null);
  const tLat = safeNumber(to?.latitude, null);
  const tLon = safeNumber(to?.longitude, null);

  if (fLat === null || fLon === null || tLat === null || tLon === null) return null;

  const projection = projectOnRoute(from, to, selectedAircraft);
  const aLat = safeNumber(selectedAircraft?.latitude, null);
  const aLon = safeNumber(selectedAircraft?.longitude, null);
  const hasAircraftPoint = aLat !== null && aLon !== null;
  const midLat = hasAircraftPoint ? aLat : projection?.reliable ? projection.projection.latitude : null;
  const midLon = hasAircraftPoint ? aLon : projection?.reliable ? projection.projection.longitude : null;
  const hasMid = midLat !== null && midLon !== null;

  return (
    <>
      <Polyline
        positions={[[fLat, fLon], [tLat, tLon]]}
        pathOptions={{
          color: '#38bdf8',
          weight: 4,
          opacity: hasMid ? 0.08 : 0.14,
          lineCap: 'round',
          lineJoin: 'round',
          className: 'ac-route-glow',
        }}
      />
      {/* Flown portion — solid green, only when no FR24 track replaces it */}
      {!hasTrack && hasMid && (
        <Polyline
          positions={[[fLat, fLon], [midLat, midLon]]}
          pathOptions={{ color: '#38bdf8', weight: 2, opacity: 0.42, lineCap: 'round', lineJoin: 'round', className: 'ac-route-flown' }}
        />
      )}
      {/* Remaining portion — animated dashed blue */}
      <Polyline
        positions={hasMid ? [[midLat, midLon], [tLat, tLon]] : [[fLat, fLon], [tLat, tLon]]}
        pathOptions={{
          color: '#7dd3fc',
          weight: 2,
          opacity: hasMid ? 0.72 : 0.52,
          dashArray: '10 12',
          lineCap: 'round',
          lineJoin: 'round',
          className: 'ac-route-line',
        }}
      />
      {/* Departure */}
      <Marker position={[fLat, fLon]} icon={buildAirportIcon()}>
        <Popup>
          <div className="ac-popup">
            <div className="ac-popup-callsign">{from.code || from.name || 'Departure'}</div>
            {from.city && <div className="ac-popup-country">{from.city}</div>}
          </div>
        </Popup>
      </Marker>
      {/* Arrival */}
      <Marker position={[tLat, tLon]} icon={buildAirportIcon()}>
        <Popup>
          <div className="ac-popup">
            <div className="ac-popup-callsign">{to.code || to.name || 'Arrival'}</div>
            {to.city && <div className="ac-popup-country">{to.city}</div>}
          </div>
        </Popup>
      </Marker>
    </>
  );
}

/* ─── SVG fallback map (shown if Leaflet fails) ──────────────── */
function mapPos(point) {
  const lon = safeNumber(point.longitude, 0);
  const lat = safeNumber(point.latitude, 0);
  return {
    x: Math.max(0, Math.min(1000, ((lon + 180) / 360) * 1000)),
    y: Math.max(0, Math.min(500, ((90 - lat) / 180) * 500)),
  };
}

function FallbackMap({ aircraft = [], onSelectAircraft, route, selectedAircraftId, trackPoints = [] }) {
  return (
    <svg viewBox="0 0 1000 500" className="tracker-map-fallback" role="img" aria-label="Live flight map">
      <defs>
        <linearGradient id="fb-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#080d14" />
          <stop offset="100%" stopColor="#0c1828" />
        </linearGradient>
      </defs>
      <rect width="1000" height="500" fill="url(#fb-bg)" />
      {Array.from({ length: 13 }).map((_, i) => (
        <line key={`v${i}`} x1={i * 83} y1="0" x2={i * 83} y2="500" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
      ))}
      {Array.from({ length: 7 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 83} x2="1000" y2={i * 83} stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
      ))}
      {/* Actual FR24 track path */}
      {trackPoints.length >= 2 ? (
        <polyline
          points={trackPoints
            .filter(p => p.latitude != null && p.longitude != null)
            .map(p => { const { x, y } = mapPos({ latitude: p.latitude, longitude: p.longitude }); return `${x},${y}`; })
            .join(' ')}
          fill="none"
          stroke="rgba(74,222,128,0.7)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : route?.from && route?.to ? (
        <line
          x1={mapPos(route.from).x} y1={mapPos(route.from).y}
          x2={mapPos(route.to).x} y2={mapPos(route.to).y}
          stroke="rgba(125,211,252,0.62)" strokeWidth="2" strokeDasharray="10 12" strokeLinecap="round"
          filter="drop-shadow(0 0 5px rgba(56,189,248,0.42))"
        />
      ) : null}
      {aircraft.map(item => {
        if (item.latitude == null || item.longitude == null) return null;
        const { x, y } = mapPos(item);
        const sel = selectedAircraftId && String(selectedAircraftId) === String(item.icao24);
        const fill = item.onGround ? '#94a3b8' : sel ? '#4ade80' : '#38bdf8';
        return (
          <g key={item.icao24} transform={`translate(${x},${y})`} onClick={() => onSelectAircraft?.(item)} style={{ cursor: 'pointer' }}>
            {sel && <circle r="14" fill="none" stroke="rgba(74,222,128,0.4)" strokeWidth="1.5" />}
            <circle r="7" fill="rgba(8,14,24,0.75)" stroke={fill} strokeWidth={sel ? 2 : 1.2} />
            <path
              d="M0,-5 L4,4 L0,2 L-4,4 Z"
              fill={fill}
              transform={`rotate(${safeNumber(item.trueTrack, 0)})`}
            />
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Error boundary ───────────────────────────────────────────── */
class MapErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <FallbackMap
          aircraft={this.props.aircraft}
          onSelectAircraft={this.props.onSelectAircraft}
          route={this.props.route}
          selectedAircraftId={this.props.selectedAircraftId}
          trackPoints={this.props.trackPoints || []}
        />
      );
    }
    return this.props.children;
  }
}

/* ─── Leaflet map ──────────────────────────────────────────────── */
function LeafletMap({ aircraft = [], center = [25, 20], zoom = 3, onSelectAircraft, airport, route, selectedAircraftId, selectedAircraft = null, trackPoints = [] }) {
  const points = useMemo(
    () => aircraft.filter(item => item.latitude != null && item.longitude != null),
    [aircraft]
  );
  const selectedPoint = useMemo(
    () => points.find(item => selectedAircraftId && String(item.icao24) === String(selectedAircraftId)) || normalizePoint(selectedAircraft || {}) || null,
    [points, selectedAircraftId, selectedAircraft]
  );

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="tracker-leaflet-map"
      scrollWheelZoom
      zoomControl={false}
      preferCanvas
      worldCopyJump={false}
      maxBounds={[[-85, -180], [85, 180]]}
      maxBoundsViscosity={0.9}
      minZoom={2}
      maxZoom={18}
    >
      <SyncMapSize />
      <ZoomControl position="bottomleft" />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
        noWrap
        bounds={[[-85, -180], [85, 180]]}
      />

      {airport && (
        <>
          <Marker position={[airport.latitude, airport.longitude]} icon={buildAirportIcon()}>
            <Popup>
              <div className="ac-popup">
                <div className="ac-popup-callsign">{airport.name || airport.airportCode}</div>
                {airport.city && <div className="ac-popup-country">{airport.city}</div>}
              </div>
            </Popup>
          </Marker>
          {airport.radiusKm && (
            <CircleMarker
              center={[airport.latitude, airport.longitude]}
              radius={Math.max(10, Math.min(32, airport.radiusKm / 3))}
              pathOptions={{ color: '#38bdf8', fillColor: '#38bdf8', fillOpacity: 0.05, weight: 1, dashArray: '4 5' }}
            />
          )}
        </>
      )}

      <TrackLayer trackPoints={trackPoints} />
      <RouteLayer route={route} hasTrack={trackPoints.length >= 2} selectedAircraft={selectedPoint} />
      <FocusSelectedAircraft aircraft={selectedPoint} />
      <ClusteredAircraftLayer
        aircraft={points}
        zoom={zoom}
        selectedAircraftId={selectedAircraftId}
        onSelectAircraft={onSelectAircraft}
      />

      {selectedPoint && (
        <Marker
          position={[selectedPoint.latitude, selectedPoint.longitude]}
          icon={buildAircraftIcon({ item: selectedPoint, zoom, selected: true })}
          zIndexOffset={2000}
          eventHandlers={{ click: () => onSelectAircraft?.(selectedPoint) }}
        >
          <Popup><AircraftPopup aircraft={selectedPoint} /></Popup>
        </Marker>
      )}
    </MapContainer>
  );
}

/* ─── Public export ────────────────────────────────────────────── */
export default function TrackerMap(props) {
  return (
    <MapErrorBoundary {...props}>
      <LeafletMap {...props} />
    </MapErrorBoundary>
  );
}
