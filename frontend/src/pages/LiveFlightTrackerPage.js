import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../apiConfig';
import TrackerMap from '../components/tracker/TrackerMap';
import AdSlot from '../components/monetization/AdSlot';
import { getTrackerCopy, getTrackerDirection, TRACKER_LANGUAGES, useSiteLanguage } from '../utils/trackerLanguage';
import { trackEvent } from '../utils/analytics';
import { featureFlags } from '../utils/featureFlags';
import './LiveFlightTrackerPage.css';

/* ─── Constants ────────────────────────────────────────────── */
const REGION_ORDER = [
  'global',
  'germany',
  'europe',
  'turkey',
  'middle-east',
  'asia',
  'africa',
  'north_america',
  'south_america',
  'oceania',
];
const AIRPORT_LINKS = ['BER', 'FRA', 'MUC', 'IST', 'SAW', 'DXB', 'BEY', 'LHR'];
const AIRPORT_OPTIONS = [
  { code: 'BER', name: 'Berlin Brandenburg Airport', city: 'Berlin', country: 'Germany' },
  { code: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany' },
  { code: 'MUC', name: 'Munich Airport', city: 'Munich', country: 'Germany' },
  { code: 'IST', name: 'Istanbul Airport', city: 'Istanbul', country: 'Turkey' },
  { code: 'SAW', name: 'Sabiha Gokcen Airport', city: 'Istanbul', country: 'Turkey' },
  { code: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'United Arab Emirates' },
  { code: 'BEY', name: 'Beirut Rafic Hariri International Airport', city: 'Beirut', country: 'Lebanon' },
  { code: 'LHR', name: 'London Heathrow Airport', city: 'London', country: 'United Kingdom' },
];
const LIMIT = 300;
const POLL_MS = 60_000;
const HEALTH_POLL_MS = 5 * 60_000;
const ALERT_TYPE_OPTIONS = [
  { value: 'status_changed', label: 'Status changes' },
  { value: 'delay_detected', label: 'Delay detected' },
  { value: 'eta_changed', label: 'ETA changes' },
  { value: 'departure_detected', label: 'Departure detected' },
  { value: 'arrival_detected', label: 'Arrival or landing' },
  { value: 'gate_terminal_changed', label: 'Gate or terminal' },
  { value: 'departure_reminder', label: 'Departure reminder' },
];
const DEFAULT_ALERT_TYPES = ['status_changed', 'delay_detected', 'eta_changed', 'arrival_detected'];

/* ─── FR24 frontend cache (module-level, 5-min TTL) ─────────── */
const fr24Cache = new Map();
const FR24_CACHE_TTL = 5 * 60_000;

function getCachedFr24(key) {
  const entry = fr24Cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > FR24_CACHE_TTL) { fr24Cache.delete(key); return null; }
  return entry.data;
}

function setCachedFr24(key, data) {
  fr24Cache.set(key, { data, fetchedAt: Date.now() });
}

/* ─── SEO helpers ───────────────────────────────────────────── */
function setMeta(attrName, value, attr = 'name') {
  if (!value || typeof document === 'undefined') return;
  let tag = document.querySelector(`meta[${attr}="${attrName}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, attrName);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', value);
}

function setCanonical(url) {
  if (typeof document === 'undefined' || !url) return;
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = url;
}

function getSiteUrl() {
  const envUrl = String(process.env.REACT_APP_SITE_URL || '').replace(/\/$/, '');
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://skybridgeflights.com';
}

function setAlternateLanguages(baseUrl, currentPath) {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('link[data-tracker-hreflang="true"]').forEach(n => n.remove());
  TRACKER_LANGUAGES.forEach(lang => {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = lang;
    link.href = `${baseUrl}${currentPath}?lang=${lang}`;
    link.setAttribute('data-tracker-hreflang', 'true');
    document.head.appendChild(link);
  });
  const def = document.createElement('link');
  def.rel = 'alternate';
  def.hreflang = 'x-default';
  def.href = `${baseUrl}${currentPath}`;
  def.setAttribute('data-tracker-hreflang', 'true');
  document.head.appendChild(def);
}

/* ─── Formatting ────────────────────────────────────────────── */
function fmtSpeed(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return `${Math.round(Number(v) * 3.6)} km/h`;
}

function fmtAlt(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return `${Math.round(Number(v)).toLocaleString()} m`;
}

function fmtVRate(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Math.round(Number(v));
  return n === 0 ? '0 m/s' : `${n > 0 ? '+' : ''}${n} m/s`;
}

function fmtHeading(v) {
  if (!Number.isFinite(Number(v))) return '—';
  return `${Math.round(Number(v))}°`;
}

function fmtDuration(minutes, lang = 'en') {
  if (minutes == null || Number.isNaN(Number(minutes))) return '—';
  const total = Math.max(0, Math.round(Number(minutes)));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (lang === 'ar') return `${h ? `${h}س ` : ''}${m ? `${m}د` : ''}`.trim() || '0د';
  return `${h ? `${h}h ` : ''}${m ? `${m}m` : ''}`.trim() || '0m';
}

function fmtDateTime(v, lang = 'en') {
  if (!v) return '—';
  const d = new Date(Number(v) * 1000 || v);
  if (Number.isNaN(d.getTime())) return '—';
  const locale = lang === 'ar' ? 'ar' : lang === 'de' ? 'de-DE' : 'en';
  return d.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

function fmtIso(v, lang = 'en') {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  const locale = lang === 'ar' ? 'ar' : lang === 'de' ? 'de-DE' : 'en';
  return d.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

function safeStr(v, fallback = '—') {
  const s = String(v || '').trim();
  return s || fallback;
}

/* ─── Utilities ─────────────────────────────────────────────── */
function normalizeKey(v = '') {
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function findAirportQuery(value = '') {
  const raw = String(value || '').trim();
  const key = normalizeKey(raw);
  if (!key) return null;
  return AIRPORT_OPTIONS.find((airport) => (
    normalizeKey(airport.code) === key ||
    normalizeKey(airport.city) === key ||
    normalizeKey(airport.name).includes(key)
  )) || null;
}

function t(lang, en, ar, de) {
  return lang === 'ar' ? ar : lang === 'de' ? de : en;
}

function buildSummary(aircraft = []) {
  const airborne = aircraft.filter(a => !a.onGround).length;
  const onGround = aircraft.filter(a => a.onGround).length;
  const countries = [...new Set(aircraft.map(a => a.originCountry).filter(Boolean))].slice(0, 6);
  const alts = aircraft
    .map(a => Number(a.geoAltitude ?? a.baroAltitude ?? null))
    .filter(Number.isFinite);
  const avgAlt = alts.length ? Math.round(alts.reduce((s, v) => s + v, 0) / alts.length) : 0;
  return { total: aircraft.length, airborne, onGround, countries, avgAlt };
}

function normalizeErr(err) {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    'Unable to load live tracker data.'
  );
}

function saveRecent(value) {
  if (typeof window === 'undefined') return [];
  const next = String(value || '').trim();
  if (!next) return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem('trackerRecentSearches') || '[]');
    const cur = Array.isArray(stored) ? stored.filter(Boolean) : [];
    const filtered = cur.filter(i => normalizeKey(i) !== normalizeKey(next));
    const updated = [next, ...filtered].slice(0, 8);
    window.localStorage.setItem('trackerRecentSearches', JSON.stringify(updated));
    return updated;
  } catch (_) {
    const fb = [next];
    try { window.localStorage.setItem('trackerRecentSearches', JSON.stringify(fb)); } catch (_) {}
    return fb;
  }
}

function toParams(obj = {}) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') p.set(k, String(v));
  });
  return p;
}

function getRegionOptions(lang) {
  const fallbackLabels = {
    asia: 'Asia',
    africa: 'Africa',
    north_america: 'North America',
    south_america: 'South America',
    oceania: 'Oceania',
  };
  const labels = {
    en: { global: 'Worldwide', germany: 'Germany', europe: 'Europe', turkey: 'Turkey', 'middle-east': 'Middle East' },
    ar: { global: 'كل العالم', germany: 'ألمانيا', europe: 'أوروبا', turkey: 'تركيا', 'middle-east': 'الشرق الأوسط' },
    de: { global: 'Weltweit', germany: 'Deutschland', europe: 'Europa', turkey: 'Türkei', 'middle-east': 'Nahost' },
  };
  return REGION_ORDER.map(value => ({
    value,
    label: labels[lang]?.[value] || labels.en[value] || fallbackLabels[value] || value,
  }));
}

function buildSuggestions({ query, aircraft = [], recentSearches = [], lang = 'en' }) {
  const target = normalizeKey(query);
  const list = [];
  const seen = new Set();

  const add = (type, label, value, hint) => {
    const key = `${type}:${normalizeKey(value || label)}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ type, label, value, hint });
  };

  aircraft.slice(0, 14).forEach(a => {
    const cs = safeStr(a.callsign, '');
    const ic = safeStr(a.icao24, '');
    const al = safeStr(a.airline || a.commercialAirline || '', '');
    const combined = normalizeKey(`${cs} ${ic} ${al}`);
    if (!target || combined.includes(target)) {
      if (cs) add('flight', cs, cs, al || a.originCountry || '');
      if (ic && ic !== cs) add('icao24', ic, ic, t(lang, 'ICAO24', 'ICAO24', 'ICAO24'));
    }
  });

  AIRPORT_LINKS.forEach(code => {
    if (!target || normalizeKey(code).includes(target)) {
      add('airport', code, code, t(lang, 'Airport intel', 'معلومات المطار', 'Flughafeninfos'));
    }
  });

  AIRPORT_OPTIONS.forEach(airport => {
    const combined = normalizeKey(`${airport.code} ${airport.name} ${airport.city} ${airport.country}`);
    if (!target || combined.includes(target)) {
      add('airport', `${airport.code} - ${airport.city}`, airport.code, airport.name);
    }
  });

  aircraft.slice(0, 60).forEach(a => {
    const airline = safeStr(a.airline || a.commercialAirline || '', '');
    if (!airline) return;
    if (!target || normalizeKey(airline).includes(target)) {
      add('airline', airline, airline, t(lang, 'Airline', 'Airline', 'Airline'));
    }
  });

  recentSearches.slice(0, 5).forEach(entry => {
    if (!entry) return;
    if (target && !normalizeKey(entry).includes(target)) return;
    add('recent', entry, entry, t(lang, 'Recent', 'حديث', 'Zuletzt'));
  });

  return list.slice(0, 8);
}

function derivePhase(ac = {}) {
  if (ac?.onGround) return 'landed';
  const vr = Number(ac?.verticalRate);
  if (Number.isFinite(vr)) {
    if (vr > 2) return 'climbing';
    if (vr < -2) return 'descending';
  }
  return 'cruising';
}

function getAirlineCode(airline = '') {
  const s = String(airline || '').trim();
  if (!s) return '';
  const m = s.match(/([A-Z0-9]{2,3})$/);
  return m ? m[1] : s.slice(0, 3).toUpperCase();
}

function haversineKmPoint(a, b) {
  const lat1 = Number(a?.latitude);
  const lon1 = Number(a?.longitude);
  const lat2 = Number(b?.latitude);
  const lon2 = Number(b?.longitude);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
  const toRad = (v) => (v * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}

function projectAircraftOnRoute(from, to, aircraft) {
  const fLat = Number(from?.latitude);
  const fLon = Number(from?.longitude);
  const tLat = Number(to?.latitude);
  const tLon = Number(to?.longitude);
  const aLat = Number(aircraft?.latitude);
  const aLon = Number(aircraft?.longitude);
  if (![fLat, fLon, tLat, tLon, aLat, aLon].every(Number.isFinite)) return null;

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
  if (lenSq <= 0) return null;

  const rawT = ((ax - fx) * dx + (ay - fy) * dy) / lenSq;
  const clampedT = Math.max(0, Math.min(1, rawT));
  const projection = {
    latitude: fy + dy * clampedT,
    longitude: (fx + dx * clampedT) / Math.cos(latRef),
  };
  const totalKm = haversineKmPoint(from, to);
  const offRouteKm = haversineKmPoint(aircraft, projection);
  const remainingKm = haversineKmPoint(projection, to);
  const reliable =
    totalKm != null &&
    offRouteKm != null &&
    rawT >= -0.08 &&
    rawT <= 1.08 &&
    offRouteKm <= Math.max(45, totalKm * 0.12);

  return {
    reliable,
    progressPercent: Math.round(clampedT * 100),
    projection,
    offRouteKm,
    remainingKm,
    totalKm,
  };
}

/* ─── Suggestion type helpers ───────────────────────────────── */
const SUG_ICON = {
  flight:  '✈',
  icao24:  '🔢',
  airport: '🏢',
  recent:  '🕐',
};

const SUG_TAG = {
  flight:  'Flight',
  icao24:  'ICAO24',
  airport: 'Airport',
  recent:  'Recent',
};

/* ─── SVG icons ─────────────────────────────────────────────── */
function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" className="ftp-search-icon" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconFilter() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  );
}

function IconRadar() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2" /><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function IconPlane() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  );
}

/* ─── Provider health dot ────────────────────────────────────── */
function ProviderDot({ ok }) {
  return <span className={`ftp-provider-dot${ok ? ' is-ok' : ''}`} aria-hidden="true" />;
}

/* ============================================================
   MAIN PAGE COMPONENT
   ============================================================ */
export default function LiveFlightTrackerPage() {
  const { flightNumber } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const lang = useSiteLanguage('en');
  const copy = useMemo(() => getTrackerCopy(lang), [lang]);
  const dir = useMemo(() => getTrackerDirection(lang), [lang]);
  const regionOptions = useMemo(() => getRegionOptions(lang), [lang]);
  const trackerFaq = useMemo(() => ([
    {
      question: 'How do I track a live flight?',
      answer: 'Enter a flight number or callsign, then select the aircraft to see live position, schedule, route and ETA details when available.',
    },
    {
      question: 'Can I track flights from Germany?',
      answer: 'Yes. Use the Germany region or airport pages such as BER, FRA and MUC to view nearby live flights.',
    },
    {
      question: 'Can I see arrival time and route?',
      answer: 'When commercial enrichment is available, Skybridge Flights shows schedule, route, estimated arrival time and airport details.',
    },
    {
      question: 'Why can flight data be delayed?',
      answer: 'Live aircraft positions depend on ADS-B coverage, network latency, airline updates and provider refresh intervals.',
    },
  ]), []);

  /* ── State ── */
  const [searchInput, setSearchInput]     = useState(flightNumber || searchParams.get('q') || '');
  const [query, setQuery]                 = useState(flightNumber || searchParams.get('q') || '');
  const [region, setRegion]               = useState(searchParams.get('region') || 'global');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [country, setCountry]             = useState('');
  const [minAlt, setMinAlt]               = useState('');
  const [maxAlt, setMaxAlt]               = useState('');
  const [minSpd, setMinSpd]               = useState('');
  const [maxSpd, setMaxSpd]               = useState('');
  const [tracker, setTracker]             = useState(null);
  const [selectedAc, setSelectedAc]       = useState(null);
  const [detail, setDetail]               = useState(null);
  const [loading, setLoading]             = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError]                 = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [suggestionIdx, setSuggestionIdx] = useState(-1);
  const [filterOpen, setFilterOpen]       = useState(() => {
    if (typeof window === 'undefined') return false;
    const desktop = window.matchMedia?.('(min-width: 769px)').matches ?? true;
    if (!desktop) return false;
    const stored = window.localStorage.getItem('trackerFilterPanelOpen');
    if (stored !== null) return stored === 'true';
    return true;
  });
  const [widgetsOpen, setWidgetsOpen]     = useState(true);
  const [detailOpen, setDetailOpen]       = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [alertEmail, setAlertEmail]       = useState('');
  const [alertTypes, setAlertTypes]       = useState(DEFAULT_ALERT_TYPES);
  const [alertLoading, setAlertLoading]   = useState(false);
  const [alertMessage, setAlertMessage]   = useState('');
  const [alertError, setAlertError]       = useState('');
  const [utilityPanel, setUtilityPanel]   = useState(null);
  const [compactPanels, setCompactPanels] = useState(false);

  /* ── FR24 enrichment state ── */
  const [fr24Detail, setFr24Detail]       = useState(null);
  const [fr24Track, setFr24Track]         = useState(null);
  const [providerHealth, setProviderHealth] = useState(null);
  const [debouncedRegion, setDebouncedRegion] = useState(searchParams.get('region') || 'global');

  const detailKeyRef   = useRef('');
  const fr24FetchIdRef = useRef('');
  const selectedAcRef  = useRef(null);
  const searchRef      = useRef(null);
  const alertEmailRef  = useRef(null);
  const queryRef       = useRef(query);

  /* ── Sync query from URL / params ── */
  useEffect(() => {
    const next = flightNumber || searchParams.get('q') || '';
    setSearchInput(next);
    setQuery(next);
  }, [flightNumber, searchParams]);

  /* ── SEO ── */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = '/flight-tracker';
    const title =
      lang === 'ar' ? 'Skybridge تتبع الرحلات الجوية | Skybridge Flights' :
      lang === 'de' ? 'Skybridge Flugtracker | Skybridge Flights' :
      'Skybridge Flight Tracker | Skybridge Flights';
    const desc =
      lang === 'ar' ? 'تتبع الطائرات والرحلات من ألمانيا وأوروبا وتركيا والشرق الأوسط مع واجهة حية واضحة وعملية.' :
      lang === 'de' ? 'Live-Flugverfolgung für Deutschland, Europa, Türkei und Nahost mit klaren Flugdaten und Kartenfokus.' :
      'Live flight tracker for Germany, Europe, Turkey and Middle East routes with a map-first aviation interface.';
    void path;
    void title;
    void desc;
    const siteUrl = getSiteUrl();
    const liveFlight = String(flightNumber || '').trim().toUpperCase();
    const seoPath = liveFlight ? `/live-flights/${encodeURIComponent(liveFlight)}` : '/flight-tracker';
    const seoTitle = liveFlight
      ? `Track flight ${liveFlight} live | Route, ETA and airport updates | Skybridge Flights`
      : 'Live Flight Tracker | Track Flights, Routes and Airports | Skybridge Flights';
    const seoDesc = liveFlight
      ? `Track flight ${liveFlight} live with route, ETA and airport updates from Skybridge Flights.`
      : 'Track live flights, aircraft positions, routes, airport updates and estimated arrival times with Skybridge Flights.';
    document.title = seoTitle;
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    setCanonical(`${siteUrl}${seoPath}`);
    setMeta('description', seoDesc);
    setMeta('og:title', seoTitle, 'property');
    setMeta('og:description', seoDesc, 'property');
    setMeta('og:url', `${siteUrl}${seoPath}`, 'property');
    setMeta('og:type', 'website', 'property');
    setMeta('twitter:card', 'summary_large_image');
    setMeta('robots', 'index,follow');
    setAlternateLanguages(siteUrl, seoPath);
  }, [lang, dir, flightNumber]);

  /* ── Load recent searches ── */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const s = JSON.parse(window.localStorage.getItem('trackerRecentSearches') || '[]');
      setRecentSearches(Array.isArray(s) ? s.slice(0, 8) : []);
    } catch (_) { setRecentSearches([]); }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const desktop = window.matchMedia?.('(min-width: 769px)').matches ?? true;
    if (!desktop) return;
    window.localStorage.setItem('trackerFilterPanelOpen', String(filterOpen));
  }, [filterOpen]);

  /* ── Keep queryRef current to avoid stale closure in live poll ── */
  useEffect(() => { queryRef.current = query; }, [query]);

  /* ── Debounce region changes 800ms to avoid hammering FR24 on rapid region switches ── */
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedRegion(region), 800);
    return () => window.clearTimeout(timer);
  }, [region]);

  /* ── Provider health (on mount, refreshed every 5 min) ── */
  useEffect(() => {
    let active = true;
    const fetchHealth = async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/flight-tracker/providers/health`);
        if (active) setProviderHealth(data);
      } catch (_) {}
    };
    fetchHealth();
    const timer = window.setInterval(fetchHealth, HEALTH_POLL_MS);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  /* ── Pick best aircraft from list ── */
  const pickBest = useCallback((aircraft = [], key = '') => {
    const target = normalizeKey(key);
    return (
      aircraft.find(a => normalizeKey(a.callsign) === target) ||
      aircraft.find(a => normalizeKey(a.icao24) === target) ||
      aircraft[0] || null
    );
  }, []);

  /* ── Fetch FR24 details + track for a selected aircraft ── */
  const fetchFr24Enrichment = useCallback(async (ac) => {
    // Only call FR24 when the live response includes an explicit fr24FlightId.
    // Callsigns, ICAO24 addresses, and flight numbers are NOT valid FR24 flight IDs.
    const id = String(ac?.fr24FlightId || '').trim();
    if (!id) return;

    fr24FetchIdRef.current = id;

    const detailKey = `detail:${id}`;
    const trackKey  = `track:${id}`;

    // Apply cache hits immediately (no loading flicker).
    const cachedDetail = getCachedFr24(detailKey);
    const cachedTrack  = getCachedFr24(trackKey);
    if (cachedDetail) setFr24Detail(cachedDetail.available ? cachedDetail : null);
    if (cachedTrack)  setFr24Track(cachedTrack.available ? cachedTrack : null);
    if (cachedDetail && cachedTrack) return;

    const fetches = [];

    if (!cachedDetail) {
      fetches.push(
        axios.get(`${API_BASE_URL}/api/flight-tracker/flights/${encodeURIComponent(id)}`)
          .then(({ data }) => {
            if (fr24FetchIdRef.current !== id) return;
            setCachedFr24(detailKey, data);
            if (data?.available) setFr24Detail(data);
          })
          .catch(() => setCachedFr24(detailKey, { available: false }))
      );
    }

    if (!cachedTrack) {
      fetches.push(
        axios.get(`${API_BASE_URL}/api/flight-tracker/track/${encodeURIComponent(id)}`)
          .then(({ data }) => {
            if (fr24FetchIdRef.current !== id) return;
            const points = Array.isArray(data?.points) ? data.points : [];
            const payload = { ...data, points };
            setCachedFr24(trackKey, payload);
            if (data?.available && points.length >= 2) setFr24Track(payload);
          })
          .catch(() => setCachedFr24(trackKey, { available: false, points: [] }))
      );
    }

    await Promise.allSettled(fetches);
  }, []);

  /* ── Fetch detail for selected aircraft (search/commercial enrichment) ── */
  const fetchDetail = useCallback(async (searchKey) => {
    const normalized = String(searchKey || '').trim();
    if (!normalized) return;
    const key = normalizeKey(normalized);
    detailKeyRef.current = key;
    setDetailLoading(true);
    try {
      const params = toParams({
        query: normalized, region, country,
        airborneOnly:    statusFilter === 'airborne' ? 'true' : '',
        includeGround:   statusFilter === 'ground'   ? 'true' : '',
        minAltitude: minAlt, maxAltitude: maxAlt,
        minSpeed: minSpd,    maxSpeed: maxSpd,
      });
      const { data } = await axios.get(`${API_BASE_URL}/api/flight-tracker/search`, { params });
      if (detailKeyRef.current !== key) return;
      const selected = data?.selectedAircraft || pickBest(data?.aircraft || [], normalized);
      if (selected) {
        setSelectedAc(selected);
        setDetailOpen(true);
        // Kick off FR24 enrichment once we have the best matching aircraft.
        fetchFr24Enrichment(selected);
      }
      setDetail({ ...data, selectedAircraft: selected || null });
      if (selected || (data?.totalMatches ?? 0) > 0) setRecentSearches(saveRecent(normalized));
    } catch (err) {
      if (detailKeyRef.current !== key) return;
      setDetail({ success: false, error: normalizeErr(err), commercial: { available: false, provider: 'none' }, route: null, dataAvailability: {} });
    } finally {
      setDetailLoading(false);
    }
  }, [country, fetchFr24Enrichment, maxAlt, maxSpd, minAlt, minSpd, pickBest, region, statusFilter]);

  /* ── Poll live tracker ── */
  useEffect(() => {
    let active = true;
    const fetchLive = async () => {
      try {
        setLoading(true);
        setError('');
        const params = toParams({
          region: debouncedRegion, limit: LIMIT, country,
          airborneOnly:  statusFilter === 'airborne' ? 'true' : '',
          includeGround: statusFilter === 'ground'   ? 'true' : '',
          minAltitude: minAlt, maxAltitude: maxAlt,
          minSpeed: minSpd, maxSpeed: maxSpd,
        });
        const { data } = await axios.get(`${API_BASE_URL}/api/flight-tracker/live`, { params });
        if (!active) return;
        setTracker(data);
        const aircraft = Array.isArray(data.aircraft) ? data.aircraft : [];
        const cur = selectedAcRef.current;
        const next =
          cur && aircraft.some(a => a.icao24 === cur.icao24)
            ? aircraft.find(a => a.icao24 === cur.icao24)
            : queryRef.current
              ? pickBest(aircraft, queryRef.current)
              : null;
        setSelectedAc(next || null);
      } catch (err) {
        if (!active) return;
        setTracker(null);
        setSelectedAc(null);
        setError(normalizeErr(err));
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchLive();
    const timer = window.setInterval(fetchLive, POLL_MS);
    return () => { active = false; window.clearInterval(timer); };
  }, [country, debouncedRegion, maxAlt, maxSpd, minAlt, minSpd, pickBest, statusFilter]);

  useEffect(() => { selectedAcRef.current = selectedAc; }, [selectedAc]);

  /* ── Auto-fetch detail when aircraft selected via live poll ── */
  /* ── Sync URL ── */
  useEffect(() => {
    const next = toParams({ q: query || '', region: region !== 'global' ? region : '' });
    setSearchParams(next, { replace: true });
  }, [query, region, setSearchParams]);

  /* ─── Derived data ──────────────────────────────────────── */
  const aircraft = useMemo(
    () => (Array.isArray(tracker?.aircraft) ? tracker.aircraft : []),
    [tracker]
  );

  const summary = tracker?.summary || buildSummary(aircraft);

  const selectedDetail = detail || {};
  const selectedFlight = selectedDetail.selectedAircraft || selectedAc || null;
  const commercial     = selectedDetail.commercial || {};
  const route          = selectedDetail.route || null;
  const dataAvail      = selectedDetail.dataAvailability || {};
  const searchNotFound = !!query.trim() && Number(selectedDetail.totalMatches || 0) === 0 && !detailLoading;
  // True when the live aircraft record itself came from FR24 (fields embedded at source).
  const liveIsFr24     = selectedFlight?.source === 'flightradar24';

  /* ── Merged FR24 + commercial data (FR24 detail > FR24 live > commercial > fallback) ── */
  const mergedAirline      = fr24Detail?.airline      || (liveIsFr24 && selectedFlight?.airline)      || commercial.airline      || selectedFlight?.airline || '';
  const mergedFlightNumber = fr24Detail?.flightNumber || (liveIsFr24 && selectedFlight?.flightNumber) || commercial.flightNumber || selectedFlight?.callsign || '';
  const mergedCallsign     = selectedFlight?.callsign || fr24Detail?.callsign || commercial.callsign || '';
  const mergedAirlineCode  = fr24Detail?.airlineCode || commercial.airlineCode || '';
  const mergedAircraftType = [fr24Detail?.aircraftModel, fr24Detail?.aircraftType].filter(Boolean).join(' ').trim()
                           || [commercial.aircraftModel, commercial.aircraftType].filter(Boolean).join(' ').trim()
                           || selectedFlight?.aircraftType || '';
  const mergedRegistration = fr24Detail?.registration || commercial.registration || selectedFlight?.registration || '';
  const rawMergedStatus    = fr24Detail?.status       || commercial.status || '';
  const mergedDelay        = fr24Detail?.delayMinutes ?? commercial.delayMinutes ?? null;
  const mergedTerminal     = fr24Detail?.departureAirport?.terminal || fr24Detail?.arrivalAirport?.terminal || commercial.terminal || '';
  const mergedGate         = fr24Detail?.departureAirport?.gate    || fr24Detail?.arrivalAirport?.gate     || commercial.gate     || '';
  const mergedSchedDep     = fr24Detail?.scheduledDeparture || commercial.scheduledDeparture || null;
  const mergedSchedArr     = fr24Detail?.scheduledArrival   || commercial.scheduledArrival   || null;
  const mergedEstArr       = fr24Detail?.estimatedArrival   || commercial.estimatedArrival   || null;
  const mergedActDep       = fr24Detail?.actualDeparture    || null;
  const mergedActArr       = fr24Detail?.actualArrival      || null;

  // Route dep/arr: prefer detailed airports, then commercial schedule airports, then route airports.
  const mergedDepAirportBase = fr24Detail?.departureAirport || commercial.departureAirport || route?.from || null;
  const mergedArrAirportBase = fr24Detail?.arrivalAirport   || commercial.arrivalAirport   || route?.to   || null;
  const mergedDepAirport = mergedDepAirportBase ? { ...mergedDepAirportBase, city: mergedDepAirportBase.name || mergedDepAirportBase.city } : null;
  const mergedArrAirport = mergedArrAirportBase ? { ...mergedArrAirportBase, city: mergedArrAirportBase.name || mergedArrAirportBase.city } : null;

  const trackPoints    = (fr24Track?.available && Array.isArray(fr24Track?.points)) ? fr24Track.points : [];
  const hasTrackData   = trackPoints.length >= 2;
  const fr24DataReady  = fr24Detail?.available === true;
  const fr24DataFailed = fr24Detail === null ? false : fr24Detail?.available === false;

  const hasAirlineData  = !!mergedAirline || !!mergedAirlineCode;
  const hasScheduleData = !!(fr24DataReady || liveIsFr24 || commercial.available || mergedSchedDep || mergedSchedArr || mergedEstArr || hasAirlineData);
  const hasRouteData    = !!(route || (mergedDepAirport?.code && mergedArrAirport?.code));
  const hasEtaData      = !!(dataAvail.hasEta || mergedEstArr || route?.remainingMinutes);
  const hasUsefulDetailData = hasRouteData || hasEtaData || hasScheduleData || hasAirlineData;
  const phase       = derivePhase(selectedFlight || {});
  const mergedStatus = rawMergedStatus && rawMergedStatus !== 'unavailable' ? rawMergedStatus : '';
  const displayStatus = mergedStatus || (hasUsefulDetailData ? phase : rawMergedStatus || phase);
  const alertFlightNumber = mergedFlightNumber || commercial.flightNumber || '';
  const alertCallsign = mergedCallsign || selectedFlight?.callsign || '';
  const alertDepartureAirport =
    mergedDepAirport?.code || mergedDepAirport?.iataCode || mergedDepAirport?.icaoCode || commercial.departureAirport?.code || '';
  const alertArrivalAirport =
    mergedArrAirport?.code || mergedArrAirport?.iataCode || mergedArrAirport?.icaoCode || commercial.arrivalAirport?.code || '';

  const trackerCenter = useMemo(() => {
    if (tracker?.center && Array.isArray(tracker.center) && tracker.center.length === 2) return tracker.center;
    switch (region) {
      case 'germany':    return [51.2, 10.3];
      case 'europe':     return [48.5, 12.5];
      case 'turkey':     return [39.0, 35.5];
      case 'middle-east': return [31.5, 44.0];
      case 'asia': return [34.0, 95.0];
      case 'africa': return [2.0, 20.0];
      case 'north_america': return [45.0, -100.0];
      case 'south_america': return [-15.0, -60.0];
      case 'oceania': return [-25.0, 135.0];
      default:           return [25, 20];
    }
  }, [tracker?.center, region]);

  const trackerZoom = useMemo(() => {
    if (region === 'global')   return 2;
    if (region === 'germany')  return 5;
    if (region === 'turkey')   return 5;
    if (region === 'north_america' || region === 'south_america' || region === 'africa' || region === 'asia' || region === 'oceania') return 3;
    return 4;
  }, [region]);

  const visibleAircraft = useMemo(
    () => aircraft
      .filter(a => a.latitude != null && a.longitude != null)
      .filter(a => {
        if (statusFilter === 'airborne') return !a.onGround;
        if (statusFilter === 'ground')   return a.onGround;
        return true;
      })
      .slice(0, LIMIT),
    [aircraft, statusFilter]
  );

  const suggestions = useMemo(
    () => buildSuggestions({ query: searchInput, aircraft: aircraft.slice(0, 18), recentSearches, lang }),
    [aircraft, lang, recentSearches, searchInput]
  );

  const airlineCode = getAirlineCode(mergedAirline);
  const routeProjection = projectAircraftOnRoute(mergedDepAirport, mergedArrAirport, selectedFlight);
  const reliableRouteProgress = routeProjection?.reliable ? routeProjection.progressPercent : null;
  const displayRoutePct = reliableRouteProgress;
  const remainingDistanceKm = routeProjection?.reliable
    ? routeProjection.remainingKm
    : Number.isFinite(Number(route?.distanceKm)) ? Number(route.distanceKm) : null;
  const delayRisk = mergedDelay != null
    ? Number(mergedDelay) >= 30 ? 'High' : Number(mergedDelay) >= 10 ? 'Medium' : 'Low'
    : mergedStatus && /delay|late/i.test(mergedStatus) ? 'Medium' : '';
  const arrivalLocalTime = mergedEstArr || mergedSchedArr || '';
  const bestNextAction = delayRisk === 'High'
    ? 'Watch ETA changes'
    : mergedArrAirport?.code
      ? 'Check airport transfer'
      : 'Track this flight by email';

  const liveIsActuallyFr24 = tracker?.provider === 'flightradar24' || (tracker?.aggregator || '').startsWith('fr24');
  const providerLabel = liveIsActuallyFr24 ? 'FR24' : 'OpenSky';
  const updatedText   = tracker?.updatedAt ? fmtIso(tracker.updatedAt, lang) : t(lang, 'Waiting…', 'بانتظار البيانات', 'Warten…');
  const liveText      = loading ? copy.tracker.refreshing : t(lang, 'LIVE', 'مباشر', 'LIVE');

  const etaText =
    mergedDelay != null
      ? Number(mergedDelay) > 0
        ? t(lang, `+${Math.round(Number(mergedDelay))} min delay`, `+${Math.round(Number(mergedDelay))} دقيقة تأخير`, `+${Math.round(Number(mergedDelay))} Min Verspätung`)
        : t(lang, 'On time', 'في الوقت', 'Pünktlich')
      : null;

  const routeUnavailMsg = t(lang, 'Route unavailable', 'المسار غير متاح', 'Route nicht verfügbar');
  const selectedMapRoute = selectedFlight?.icao24 && route ? route : null;
  const activeRegionLabel = regionOptions.find(o => o.value === region)?.label || '';
  const commercialProviderLabel = commercial.provider === 'aerodatabox'
    ? 'AeroDataBox'
    : commercial.provider
      ? commercial.provider
      : 'AeroDataBox';

  /* ── Provider health derived values ── */
  const ph = providerHealth?.providers || {};
  const fr24Ok  = !!ph.flightradar24?.configured;
  const oskyOk  = true; // OpenSky always available
  const commProvider = ph.commercial?.provider || commercial?.provider || '';
  const commOk  = !!ph.commercial?.configured;
  const showProviderHealth = !!providerHealth;

  /* ─── Handlers ────────────────────────────────────────────── */
  const handleSubmit = (e) => {
    e.preventDefault();
    const next = searchInput.trim();
    const airportMatch = findAirportQuery(next);
    if (airportMatch) {
      setSelectedAc(null);
      setDetail(null);
      setDetailOpen(false);
      setUtilityPanel(null);
      setSearchFocused(false);
      setSuggestionIdx(-1);
      setRecentSearches(saveRecent(airportMatch.code));
      navigate(`/airports/${airportMatch.code}`);
      return;
    }
    setQuery(next);
    setSuggestionIdx(-1);
    setSearchFocused(false);
    if (next) {
      setRecentSearches(saveRecent(next));
      trackEvent('flight_search', { metadata: { query: next, region } });
      fetchDetail(next);
    } else {
      setDetail(null);
      setFr24Detail(null);
      setFr24Track(null);
      detailKeyRef.current = '';
      fr24FetchIdRef.current = '';
    }
  };

  const handleSelectAc = (item) => {
    setSelectedAc(item);
    setDetail(null);
    setDetailOpen(true);
    setAlertMessage('');
    setAlertError('');
    // Clear stale FR24 data immediately so panel updates cleanly.
    setFr24Detail(null);
    setFr24Track(null);
    fr24FetchIdRef.current = '';
    if (item) {
      trackEvent('aircraft_selected', {
        metadata: {
          callsign: item.callsign || '',
          icao24: item.icao24 || '',
          region,
        },
      });
      fetchFr24Enrichment(item);
      fetchDetail(item.callsign || item.icao24);
      setSearchInput(item.callsign || item.icao24 || '');
      setQuery(item.callsign || item.icao24 || '');
      setRecentSearches(saveRecent(item.callsign || item.icao24 || ''));
    }
  };

  const handleSugSelect = (sug) => {
    if (!sug?.value) return;
    const airportMatch = sug.type === 'airport' ? findAirportQuery(sug.value) : findAirportQuery(sug.value);
    if (airportMatch) {
      setSelectedAc(null);
      setDetail(null);
      setDetailOpen(false);
      setUtilityPanel(null);
      setSearchInput(airportMatch.code);
      setSearchFocused(false);
      setSuggestionIdx(-1);
      setRecentSearches(saveRecent(airportMatch.code));
      navigate(`/airports/${encodeURIComponent(airportMatch.code)}`);
      return;
    }
    setSearchInput(sug.value);
    setQuery(sug.value);
    setAlertMessage('');
    setAlertError('');
    setSuggestionIdx(-1);
    setSearchFocused(false);
    trackEvent('flight_search', { metadata: { query: sug.value, suggestionType: sug.type || '', region } });
    fetchDetail(sug.value);
  };

  const toggleAlertType = (value) => {
    setAlertTypes((prev) => {
      if (prev.includes(value)) {
        const next = prev.filter((item) => item !== value);
        return next.length ? next : prev;
      }
      return [...prev, value];
    });
  };

  const handleAlertSubscribe = async (e) => {
    e.preventDefault();
    setAlertLoading(true);
    setAlertMessage('');
    setAlertError('');
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/flight-alerts/subscribe`, {
        email: alertEmail,
        flightNumber: alertFlightNumber,
        callsign: alertCallsign,
        departureAirport: alertDepartureAirport,
        arrivalAirport: alertArrivalAirport,
        alertTypes,
        lastKnownFlightStatus: displayStatus,
        lastKnownEta: mergedEstArr,
      });
      trackEvent('flight_alert_subscribe', {
        metadata: {
          flightNumber: alertFlightNumber,
          callsign: alertCallsign,
          departureAirport: alertDepartureAirport,
          arrivalAirport: alertArrivalAirport,
          alertTypes: alertTypes.join(','),
        },
      });
      setAlertMessage(data?.message || 'Flight alerts are enabled for this flight.');
    } catch (err) {
      setAlertError(err?.response?.data?.message || 'Unable to enable flight alerts right now.');
    } finally {
      setAlertLoading(false);
    }
  };

  const handleSearchKeyDown = (e) => {
    const count = suggestions.length;
    if (count === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSuggestionIdx(prev => (prev + 1) % count);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSuggestionIdx(prev => (prev - 1 + count) % count);
    } else if (e.key === 'Enter' && suggestionIdx >= 0 && suggestions[suggestionIdx]) {
      e.preventDefault();
      handleSugSelect(suggestions[suggestionIdx]);
    } else if (e.key === 'Escape') {
      setSearchFocused(false);
      setSuggestionIdx(-1);
    }
  };

  const clearSearch = () => {
    setSearchInput('');
    setQuery('');
    setDetail(null);
    setSelectedAc(null);
    setFr24Detail(null);
    setFr24Track(null);
    setAlertMessage('');
    setAlertError('');
    detailKeyRef.current = '';
    fr24FetchIdRef.current = '';
    setDetailOpen(false);
    setSuggestionIdx(-1);
    searchRef.current?.focus();
  };

  const clearFilters = () => {
    clearSearch();
    setCountry('');
    setStatusFilter('all');
    setMinAlt('');
    setMaxAlt('');
    setMinSpd('');
    setMaxSpd('');
    setRegion('global');
    setSearchParams(toParams({}), { replace: true });
  };

  /* ─── Schema.org ─────────────────────────────────────────── */
  const schema = useMemo(() => {
    const siteUrl = getSiteUrl();
    const liveFlight = String(flightNumber || '').trim().toUpperCase();
    const path = liveFlight ? `/live-flights/${encodeURIComponent(liveFlight)}` : '/flight-tracker';
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          name: liveFlight ? `Track flight ${liveFlight} live with route, ETA and airport updates` : 'Live Flight Tracker | Track Flights, Routes and Airports',
          description: liveFlight ? `Track flight ${liveFlight} live with route, ETA and airport updates.` : 'Track live flights, routes, airports and estimated arrival times.',
          url: `${siteUrl}${path}`,
          inLanguage: lang,
          mainEntity: { '@type': 'ItemList', name: 'Live flight results', numberOfItems: summary.total || 0 },
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Flight Tracker', item: `${siteUrl}/flight-tracker` },
            ...(liveFlight ? [{ '@type': 'ListItem', position: 3, name: liveFlight, item: `${siteUrl}${path}` }] : []),
          ],
        },
        {
          '@type': 'FAQPage',
          mainEntity: trackerFaq.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          })),
        },
      ],
    };
  }, [flightNumber, lang, summary.total, trackerFaq]);

  /* ─── Render ─────────────────────────────────────────────── */
  const showSuggestions = searchFocused && searchInput.trim().length > 0;
  const hasSelectedFlight = !!selectedFlight;
  const filterPanelActive = filterOpen;

  return (
    <div className={`ftp-page${compactPanels ? ' is-compact-panels' : ''}`} dir={dir} lang={lang}>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>

      {/* ══ INTEGRATED TOPBAR ══ */}
      <header className="ftp-topbar">
        <Link to="/" className="ftp-brand" aria-label="Back to Skybridge Flights">
          <div className="ftp-brand-icon">
            <IconPlane />
          </div>
          <div>
            <div className="ftp-brand-name">Skybridge</div>
            <div className="ftp-brand-sub">Flights</div>
          </div>
        </Link>

        <div className="ftp-topbar-sep" />
        <h1 className="ftp-topbar-title">{copy.tracker.pageTitle}</h1>

        <div className="ftp-topbar-right">
          <span className="ftp-live-pill">
            <i className="ftp-live-dot" aria-hidden="true" />
            {liveText}
          </span>
          <span className="ftp-stat-pill">{summary.total || 0} {t(lang, 'ac', 'طائرة', 'Flugz.')}</span>
          <span className="ftp-stat-pill">{providerLabel}</span>
          <button
            type="button"
            className={`ftp-panel-toggle${filterPanelActive ? ' is-active' : ''}`}
            onClick={() => setFilterOpen(prev => !prev)}
            aria-label={filterPanelActive ? t(lang, 'Close filters', 'إغلاق المرشحات', 'Filter schließen') : t(lang, 'Open filters', 'فتح المرشحات', 'Filter öffnen')}
          >
            <IconFilter />
          </button>
        </div>
      </header>

      {/* ══ MAP WORKSPACE ══ */}
      <div className="ftp-workspace">

        {/* MAP — fills everything */}
        <div className="ftp-map-stage">
          <TrackerMap
            aircraft={visibleAircraft}
            center={trackerCenter}
            zoom={trackerZoom}
            onSelectAircraft={handleSelectAc}
            airport={null}
            route={selectedMapRoute}
            trackPoints={selectedMapRoute ? trackPoints : []}
            selectedAircraftId={selectedFlight?.icao24}
            selectedAircraft={selectedFlight}
          />
        </div>

        {/* ── FLOATING SEARCH BAR ── */}
        <div className="ftp-search-float">
          <form className="ftp-search-form" onSubmit={handleSubmit} autoComplete="off">
            <div className="ftp-search-input-wrap">
              <IconSearch />
              <input
                ref={searchRef}
                type="text"
                className="ftp-search-input"
                value={searchInput}
                placeholder={copy.tracker.searchPlaceholder}
                aria-label={copy.tracker.searchLabel}
                onChange={e => { setSearchInput(e.target.value); setSuggestionIdx(-1); }}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => window.setTimeout(() => { setSearchFocused(false); setSuggestionIdx(-1); }, 130)}
                onKeyDown={handleSearchKeyDown}
              />
              {searchInput && (
                <button type="button" className="ftp-search-clear" onClick={clearSearch} aria-label="Clear search">×</button>
              )}
            </div>
            <button type="submit" className="ftp-search-submit" disabled={detailLoading}>
              {detailLoading ? '…' : copy.tracker.searchButton}
            </button>
          </form>

          {/* Suggestions */}
          {showSuggestions && (
            <div className="ftp-suggestions" role="listbox" aria-label={t(lang, 'Search suggestions', 'اقتراحات البحث', 'Suchvorschläge')}>
              {suggestions.length > 0 ? (
                suggestions.map((sug, idx) => (
                  <button
                    key={`${sug.type}-${sug.value}`}
                    type="button"
                    role="option"
                    aria-selected={idx === suggestionIdx}
                    className={`ftp-suggestion-item${idx === suggestionIdx ? ' is-focused' : ''}`}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => handleSugSelect(sug)}
                  >
                    <span className={`ftp-sug-icon ftp-sug-icon--${sug.type}`}>{SUG_ICON[sug.type] || '✈'}</span>
                    <span className="ftp-sug-body">
                      <span className="ftp-sug-label">{sug.label}</span>
                      {sug.hint && <span className="ftp-sug-hint">{sug.hint}</span>}
                    </span>
                    <span className={`ftp-sug-tag ftp-sug-tag--${sug.type}`}>
                      {t(lang, SUG_TAG[sug.type] || (sug.type === 'airline' ? 'Airline' : sug.type), SUG_TAG[sug.type] || (sug.type === 'airline' ? 'Airline' : sug.type), SUG_TAG[sug.type] || (sug.type === 'airline' ? 'Airline' : sug.type))}
                    </span>
                  </button>
                ))
              ) : (
                <div className="ftp-sug-empty">
                  {t(lang,
                    `No results for "${searchInput.trim()}"`,
                    `لا نتائج لـ "${searchInput.trim()}"`,
                    `Keine Ergebnisse für „${searchInput.trim()}"`,
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── FILTER PANEL (left) ── */}
        <aside className={`ftp-filter-panel${filterOpen ? ' is-open' : ''}`}>
          <div className="ftp-filter-panel-inner">
            <div className="ftp-filter-head">
              <span className="ftp-filter-title">{t(lang, 'Filters', 'المرشحات', 'Filter')}</span>
              <button type="button" className="ftp-reset-btn" onClick={clearFilters}>
                {copy.tracker.resetButton}
              </button>
            </div>

            {/* Stats */}
            <div className="ftp-stat-grid">
              <div className="ftp-stat-card">
                <div className="ftp-stat-value">{summary.total || 0}</div>
                <div className="ftp-stat-label">{t(lang, 'Total', 'الكل', 'Gesamt')}</div>
              </div>
              <div className="ftp-stat-card">
                <div className="ftp-stat-value">{summary.airborne || 0}</div>
                <div className="ftp-stat-label">{copy.tracker.statusAirborne}</div>
              </div>
              <div className="ftp-stat-card">
                <div className="ftp-stat-value">{summary.onGround || 0}</div>
                <div className="ftp-stat-label">{copy.tracker.statusGround}</div>
              </div>
              <div className="ftp-stat-card">
                <div className="ftp-stat-value" style={{ fontSize: '0.78rem' }}>{providerLabel}</div>
                <div className="ftp-stat-label">{t(lang, 'Source', 'المصدر', 'Quelle')}</div>
              </div>
            </div>

            {/* Region */}
            <div className="ftp-filter-block">
              <div className="ftp-filter-block-label">{copy.tracker.regionLabel}</div>
              <div className="ftp-chip-row">
                {regionOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`ftp-chip${region === opt.value ? ' is-active' : ''}`}
                    onClick={() => setRegion(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="ftp-filter-block">
              <div className="ftp-filter-block-label">{copy.tracker.statusLabel}</div>
              <div className="ftp-chip-row">
                {[
                  { value: 'all',      label: copy.tracker.statusAll },
                  { value: 'airborne', label: copy.tracker.statusAirborne },
                  { value: 'ground',   label: copy.tracker.statusGround },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`ftp-chip${statusFilter === opt.value ? ' is-active' : ''}`}
                    onClick={() => setStatusFilter(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Altitude */}
            <div className="ftp-filter-block">
              <div className="ftp-filter-block-label">{t(lang, 'Altitude (m)', 'الارتفاع (م)', 'Höhe (m)')}</div>
              <div className="ftp-range-grid">
                <div className="ftp-range-field">
                  <div className="ftp-range-label">{t(lang, 'Min', 'الدنيا', 'Min')}</div>
                  <input type="number" className="ftp-range-input" value={minAlt} onChange={e => setMinAlt(e.target.value)} placeholder="0" />
                </div>
                <div className="ftp-range-field">
                  <div className="ftp-range-label">{t(lang, 'Max', 'الأقصى', 'Max')}</div>
                  <input type="number" className="ftp-range-input" value={maxAlt} onChange={e => setMaxAlt(e.target.value)} placeholder="12000" />
                </div>
              </div>
            </div>

            {/* Speed */}
            <div className="ftp-filter-block">
              <div className="ftp-filter-block-label">{t(lang, 'Speed (km/h)', 'السرعة (كم/س)', 'Tempo (km/h)')}</div>
              <div className="ftp-range-grid">
                <div className="ftp-range-field">
                  <div className="ftp-range-label">{t(lang, 'Min', 'الدنيا', 'Min')}</div>
                  <input type="number" className="ftp-range-input" value={minSpd} onChange={e => setMinSpd(e.target.value)} placeholder="0" />
                </div>
                <div className="ftp-range-field">
                  <div className="ftp-range-label">{t(lang, 'Max', 'الأقصى', 'Max')}</div>
                  <input type="number" className="ftp-range-input" value={maxSpd} onChange={e => setMaxSpd(e.target.value)} placeholder="1200" />
                </div>
              </div>
            </div>

            {/* Recent searches */}
            <div className="ftp-filter-block">
              <div className="ftp-filter-block-label">{t(lang, 'Recent searches', 'البحوث الأخيرة', 'Zuletzt gesucht')}</div>
              {recentSearches.length > 0 ? (
                <div className="ftp-recent-list">
                  {recentSearches.slice(0, 5).map(item => (
                    <button
                      key={item}
                      type="button"
                      className="ftp-recent-item"
                      onClick={() => handleSugSelect({ value: item })}
                    >
                      <span className="ftp-recent-icon">🕐</span>
                      {item}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="ftp-muted">{t(lang, 'No recent searches.', 'لا توجد بحوث أخيرة.', 'Keine letzten Suchen.')}</div>
              )}
            </div>

            {/* Quick links */}
            <div className="ftp-filter-block">
              <div className="ftp-filter-block-label">{t(lang, 'Quick links', 'روابط سريعة', 'Schnelllinks')}</div>
              <div className="ftp-link-list">
                <Link to="/flights">{copy.tracker.bookCta}</Link>
                <Link to="/blog">{copy.tracker.travelGuidance}</Link>
                {AIRPORT_LINKS.slice(0, 4).map(code => (
                  <Link key={code} to={`/airports/${code}`}>{code}</Link>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* ── DETAIL PANEL (right) ── */}
        <div className={`ftp-widget-stack${widgetsOpen ? ' is-open' : ''}`}>
          <button type="button" className="ftp-widget-toggle" onClick={() => setWidgetsOpen(prev => !prev)}>
            {widgetsOpen ? 'Hide insights' : 'Show insights'}
          </button>
          {widgetsOpen && (
            <div className="ftp-widget-list">
              <div className="ftp-mini-widget">
                <span>Most tracked</span>
                <strong>{query || selectedFlight?.callsign || 'Live flights'}</strong>
              </div>
              <div className="ftp-mini-widget">
                <span>Delayed flights</span>
                <strong>{mergedDelay != null && Number(mergedDelay) > 0 ? `${Math.round(Number(mergedDelay))} min` : 'No major delay'}</strong>
              </div>
              <div className="ftp-mini-widget">
                <span>Flight alerts</span>
                <strong>{hasSelectedFlight ? 'Available' : 'Select aircraft'}</strong>
              </div>
            </div>
          )}
        </div>

        <aside className={`ftp-detail-panel${detailOpen && hasSelectedFlight ? ' is-active' : ''}`}>
          {hasSelectedFlight ? (
            <div className="ftp-detail-inner">

              {/* Flight header */}
              <div className="ftp-flight-header">
                <div className="ftp-airline-badge">
                  {airlineCode || '✈'}
                </div>
                <div className="ftp-flight-ident">
                  <div className="ftp-flight-number">
                    {[mergedFlightNumber, mergedCallsign].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(' • ') || selectedFlight.icao24}
                  </div>
                  <div className="ftp-airline-name">
                    {mergedAirline || selectedFlight.originCountry || '—'}
                    {liveIsFr24 && <span className="ftp-provider-tag" style={{ marginLeft: 6 }}>FR24</span>}
                  </div>
                  <div className="ftp-flight-status-row">
                    <span className={`ftp-status-badge ftp-status-badge--${phase}`}>
                      {displayStatus}
                    </span>
                    {selectedFlight.onGround && (
                      <span className="ftp-status-badge ftp-status-badge--ground">
                        {copy.tracker.statusGround}
                      </span>
                    )}
                    {etaText && (
                      <span className={`ftp-status-badge ftp-status-badge--${Number(mergedDelay) > 0 ? 'delayed' : 'ontime'}`}>
                        {etaText}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="ftp-detail-close"
                  onClick={() => setDetailOpen(false)}
                  aria-label="Close panel"
                >
                  ×
                </button>
              </div>

              {/* Route card */}
              <div className="ftp-route-card">
                <div className="ftp-route-airports">
                  <div>
                    <div className="ftp-airport-code">{mergedDepAirport?.code || '—'}</div>
                    <div className="ftp-airport-name">{mergedDepAirport?.city || mergedDepAirport?.name || t(lang, 'Departure', 'المغادرة', 'Abflug')}</div>
                    <div className="ftp-airport-time">{fmtIso(mergedSchedDep, lang)}</div>
                  </div>
                  <div className="ftp-route-arrow-col">
                    <div className="ftp-route-track">
                      <div className="ftp-route-track-fill" style={{ width: `${displayRoutePct ?? 0}%` }} />
                    </div>
                    {route?.distanceKm && (
                      <div className="ftp-route-dist">{Math.round(route.distanceKm)} km</div>
                    )}
                  </div>
                  <div className="ftp-airport--right">
                    <div className="ftp-airport-code">{mergedArrAirport?.code || '—'}</div>
                    <div className="ftp-airport-name">{mergedArrAirport?.city || mergedArrAirport?.name || t(lang, 'Arrival', 'الوصول', 'Ankunft')}</div>
                    <div className="ftp-airport-time">{fmtIso(mergedSchedArr, lang)}</div>
                  </div>
                </div>
                <div className="ftp-route-footer">
                  {route?.remainingMinutes ? (
                    <span className="ftp-remaining">
                      {fmtDuration(route.remainingMinutes, lang)} {t(lang, 'remaining', 'متبقية', 'verbleibend')}
                      {route.approximate ? ` (${copy.tracker.approximate})` : ''}
                    </span>
                  ) : (
                    <span className="ftp-remaining">{!route ? routeUnavailMsg : ''}</span>
                  )}
                  {fmtIso(mergedEstArr, lang) !== '—' && (
                    <span className="ftp-remaining">ETA {fmtIso(mergedEstArr, lang)}</span>
                  )}
                  {displayRoutePct != null && (
                    <span className="ftp-remaining">{displayRoutePct}% complete</span>
                  )}
                </div>
              </div>

              <div className="ftp-smart-actions">
                <button type="button" onClick={() => alertEmailRef.current?.focus()}>
                  Track this flight by email
                </button>
                <Link to={`/flights?intent=hotel&airport=${encodeURIComponent(mergedArrAirport?.code || '')}`}>
                  Book hotel near arrival
                </Link>
                <Link to={`/flights?intent=transfer&airport=${encodeURIComponent(mergedArrAirport?.code || '')}`}>
                  Airport transfer
                </Link>
                <Link to={`/flights?from=${encodeURIComponent(mergedDepAirport?.code || '')}&to=${encodeURIComponent(mergedArrAirport?.code || '')}`}>
                  Search this route
                </Link>
              </div>

              <div className="ftp-insight-card">
                <div className="ftp-section-label">Flight insight</div>
                <div className="ftp-insight-grid">
                  {delayRisk && (
                    <div><span>Delay risk</span><strong>{delayRisk}</strong></div>
                  )}
                  {arrivalLocalTime && (
                    <div><span>Arrival local time</span><strong>{fmtIso(arrivalLocalTime, lang)}</strong></div>
                  )}
                  {remainingDistanceKm != null && (
                    <div><span>Distance remaining</span><strong>{Math.round(remainingDistanceKm)} km</strong></div>
                  )}
                  <div><span>Best next action</span><strong>{bestNextAction}</strong></div>
                </div>
              </div>

              {/* Live telemetry */}
              <div className="ftp-detail-section">
                <div className="ftp-section-label">{t(lang, 'Live data', 'بيانات مباشرة', 'Live-Daten')}</div>
                <div className="ftp-telem-grid">
                  <div className="ftp-telem-card">
                    <div className="ftp-telem-value">{fmtSpeed(selectedFlight.velocity)}</div>
                    <div className="ftp-telem-label">{copy.tracker.speed}</div>
                  </div>
                  <div className="ftp-telem-card">
                    <div className="ftp-telem-value">{fmtAlt(selectedFlight.geoAltitude ?? selectedFlight.baroAltitude)}</div>
                    <div className="ftp-telem-label">{copy.tracker.altitude}</div>
                  </div>
                  <div className="ftp-telem-card">
                    <div className="ftp-telem-value">{fmtHeading(selectedFlight.trueTrack)}</div>
                    <div className="ftp-telem-label">{copy.tracker.heading}</div>
                  </div>
                  <div className="ftp-telem-card">
                    <div className="ftp-telem-value">{fmtVRate(selectedFlight.verticalRate)}</div>
                    <div className="ftp-telem-label">{copy.tracker.verticalRate}</div>
                  </div>
                </div>
              </div>

              {/* Data availability */}
              <div className="ftp-detail-section">
                <div className="ftp-section-label">{t(lang, 'Coverage', 'التغطية', 'Abdeckung')}</div>
                <div className="ftp-avail-chips">
                  <span className={`ftp-avail-chip ftp-avail-chip--${dataAvail.hasLivePosition ? 'ok' : 'off'}`}>
                    {dataAvail.hasLivePosition ? '● ' : '○ '}{t(lang, 'Live position', 'موضع مباشر', 'Live-Position')}
                  </span>
                  <span className={`ftp-avail-chip ftp-avail-chip--${hasScheduleData ? 'ok' : 'off'}`}>
                    {hasScheduleData ? '● ' : '○ '}{t(lang, 'Schedule', 'الجدول', 'Fahrplan')}
                  </span>
                  <span className={`ftp-avail-chip ftp-avail-chip--${route ? 'ok' : 'off'}`}>
                    {route ? '● ' : '○ '}{t(lang, 'Route', 'المسار', 'Route')}
                  </span>
                  <span className={`ftp-avail-chip ftp-avail-chip--${hasTrackData ? 'ok' : 'off'}`}>
                    {hasTrackData ? '● ' : '○ '}{t(lang, 'Track', 'المسار التاريخي', 'Spur')}
                    {hasTrackData ? ` (${trackPoints.length}pts)` : ''}
                  </span>
                  <span className={`ftp-avail-chip ftp-avail-chip--${dataAvail.hasEta ? 'ok' : 'off'}`}>
                    {dataAvail.hasEta ? '● ' : '○ '}ETA
                  </span>
                </div>
              </div>

              <div className="ftp-detail-section">
                <div className="ftp-section-label">{t(lang, 'Providers', 'المزودون', 'Anbieter')}</div>
                <div className="ftp-provider-grid">
                  <div className="ftp-provider-row">
                    <span>Live</span>
                    <strong>OpenSky</strong>
                  </div>
                  <div className="ftp-provider-row">
                    <span>Commercial</span>
                    <strong>{commercialProviderLabel}</strong>
                  </div>
                </div>
              </div>

              <AdSlot
                placement="tracker_details_inline"
                metadata={{ flightNumber: alertFlightNumber, callsign: alertCallsign }}
              />

              {/* FR24-enriched aircraft & schedule */}
              {(fr24DataReady || liveIsFr24) ? (
                <div className="ftp-detail-section">
                  <div className="ftp-section-label">
                    {t(lang, 'Flight details', 'تفاصيل الرحلة', 'Flugdetails')}
                    <span className="ftp-provider-tag">FR24</span>
                  </div>
                  <div className="ftp-info-rows">
                    {[
                      { label: t(lang, 'Aircraft', 'الطائرة', 'Flugzeugtyp'),       value: safeStr(mergedAircraftType) },
                      { label: t(lang, 'Registration', 'التسجيل', 'Kennzeichen'),    value: safeStr(mergedRegistration) },
                      { label: t(lang, 'Status', 'الحالة', 'Status'),               value: safeStr(mergedStatus || phase) },
                      ...(fr24DataReady ? [
                        { label: copy.tracker.scheduledDeparture,                      value: fmtIso(mergedSchedDep, lang) },
                        { label: copy.tracker.scheduledArrival,                        value: fmtIso(mergedSchedArr, lang) },
                        { label: copy.tracker.estimatedArrival,                        value: fmtIso(mergedEstArr, lang) },
                        { label: t(lang, 'Actual dep.', 'مغادرة فعلية', 'Tats. Abfl.'), value: fmtIso(mergedActDep, lang) },
                        { label: t(lang, 'Actual arr.', 'وصول فعلي',   'Tats. Ank.'),  value: fmtIso(mergedActArr, lang) },
                        { label: copy.tracker.delay,                                    value: mergedDelay != null ? `${Math.round(Number(mergedDelay))} min` : t(lang, 'On time', 'في الوقت', 'Pünktlich') },
                        { label: copy.tracker.terminal,                                 value: safeStr(mergedTerminal) },
                        { label: copy.tracker.gate,                                     value: safeStr(mergedGate) },
                      ] : []),
                    ].filter(r => r.value && r.value !== '—').map(r => (
                      <div key={r.label} className="ftp-info-row">
                        <span className="ftp-info-label">{r.label}</span>
                        <span className="ftp-info-value">{r.value}</span>
                      </div>
                    ))}
                  </div>
                  {liveIsFr24 && !selectedFlight?.fr24FlightId && !fr24DataReady && (
                    <div className="ftp-fr24-unavailable" style={{ marginTop: 8 }}>
                      {t(lang,
                        'FR24 detailed data unavailable for this aircraft.',
                        'البيانات التفصيلية من FR24 غير متاحة لهذه الطائرة.',
                        'FR24-Detaildaten für dieses Flugzeug nicht verfügbar.',
                      )}
                    </div>
                  )}
                </div>
              ) : fr24DataFailed && !hasUsefulDetailData ? (
                <div className="ftp-detail-section">
                  <div className="ftp-fr24-unavailable">
                    {t(lang, 'Extended flight data unavailable from provider.', 'البيانات التفصيلية للرحلة غير متاحة من المزود.', 'Erweiterte Flugdaten vom Anbieter nicht verfügbar.')}
                  </div>
                </div>
              ) : hasScheduleData ? (
                /* Fall back to commercial data if FR24 hasn't responded yet */
                <div className="ftp-detail-section">
                  <div className="ftp-section-label">{copy.tracker.commercialDetails}</div>
                  <div className="ftp-info-rows">
                    {[
                      { label: t(lang, 'Flight', 'الرحلة', 'Flug'), value: [mergedFlightNumber, mergedCallsign].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(' • ') },
                      { label: t(lang, 'Airline', 'شركة الطيران', 'Airline'), value: safeStr(mergedAirline) },
                      { label: t(lang, 'Airline code', 'رمز شركة الطيران', 'Airline-Code'), value: safeStr(mergedAirlineCode) },
                      { label: t(lang, 'Aircraft', 'الطائرة', 'Flugzeugtyp'), value: safeStr(mergedAircraftType) },
                      { label: t(lang, 'Registration', 'التسجيل', 'Kennzeichen'), value: safeStr(mergedRegistration) },
                      { label: t(lang, 'Departure airport', 'مطار المغادرة', 'Abflughafen'), value: safeStr(mergedDepAirport?.name || mergedDepAirport?.city || mergedDepAirport?.code) },
                      { label: t(lang, 'Arrival airport', 'مطار الوصول', 'Zielflughafen'), value: safeStr(mergedArrAirport?.name || mergedArrAirport?.city || mergedArrAirport?.code) },
                      { label: copy.tracker.flightStatus,       value: safeStr(displayStatus) },
                      { label: copy.tracker.scheduledDeparture, value: fmtIso(commercial.scheduledDeparture, lang) },
                      { label: copy.tracker.scheduledArrival,   value: fmtIso(commercial.scheduledArrival, lang) },
                      { label: copy.tracker.estimatedArrival,   value: fmtIso(commercial.estimatedArrival, lang) },
                      { label: copy.tracker.delay,              value: commercial.delayMinutes != null ? `${Math.round(Number(commercial.delayMinutes))} min` : t(lang, 'On time', 'في الوقت', 'Pünktlich') },
                      { label: copy.tracker.terminal,           value: safeStr(commercial.terminal) },
                      { label: copy.tracker.gate,               value: safeStr(commercial.gate) },
                    ].filter(r => r.value && r.value !== '—').map(r => (
                      <div key={r.label} className="ftp-info-row">
                        <span className="ftp-info-label">{r.label}</span>
                        <span className="ftp-info-value">{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Track notice when unavailable */}
              {!hasTrackData && fr24DataFailed && (
                <div className="ftp-detail-section">
                  <div className="ftp-track-notice">
                    {t(lang, 'Track unavailable from provider.', 'مسار الرحلة غير متاح من المزود.', 'Spur vom Anbieter nicht verfügbar.')}
                  </div>
                </div>
              )}

              {/* Aircraft info */}
              <div className="ftp-detail-section">
                <div className="ftp-section-label">{t(lang, 'Aircraft', 'الطائرة', 'Flugzeug')}</div>
                <div className="ftp-info-rows">
                  {[
                    { label: t(lang, 'Flight', 'الرحلة', 'Flug'), value: [mergedFlightNumber, mergedCallsign].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(' • ') },
                    { label: t(lang, 'Airline', 'شركة الطيران', 'Airline'), value: safeStr(mergedAirline) },
                    { label: t(lang, 'Airline code', 'رمز شركة الطيران', 'Airline-Code'), value: safeStr(mergedAirlineCode) },
                    { label: t(lang, 'Aircraft model', 'طراز الطائرة', 'Flugzeugmodell'), value: safeStr(mergedAircraftType) },
                    { label: t(lang, 'Registration', 'التسجيل', 'Kennzeichen'), value: safeStr(mergedRegistration) },
                    { label: copy.tracker.callsign,     value: safeStr(selectedFlight.callsign) },
                    { label: copy.tracker.icao24,        value: safeStr(selectedFlight.icao24) },
                    { label: copy.tracker.originCountry, value: safeStr(selectedFlight.originCountry) },
                    { label: t(lang, 'Squawk', 'كود الطائرة', 'Squawk'), value: safeStr(selectedFlight.squawk) },
                    { label: copy.tracker.lastContact,   value: fmtDateTime(selectedFlight.lastContact, lang) },
                    { label: copy.tracker.dataSource,    value: safeStr(fr24DataReady ? 'FR24 + ' + (selectedFlight.source || providerLabel) : liveIsFr24 ? 'FR24 (live)' : selectedFlight.source || tracker?.source || providerLabel) },
                  ].filter(r => r.value && r.value !== '—').map(r => (
                    <div key={r.label} className="ftp-info-row">
                      <span className="ftp-info-label">{r.label}</span>
                      <span className="ftp-info-value">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <AdSlot
                placement="tracker_sidebar_bottom"
                metadata={{ flightNumber: alertFlightNumber, callsign: alertCallsign }}
              />

              <div className="ftp-detail-section">
                <div className="ftp-section-label">{t(lang, 'Flight alerts', 'Flight alerts', 'Flughinweise')}</div>
                <form className="ftp-alert-subscribe" onSubmit={handleAlertSubscribe}>
                  <div className="ftp-alert-title">
                    {t(lang, 'Get flight updates by email', 'Get flight updates by email', 'Flugupdates per E-Mail erhalten')}
                  </div>
                  <input
                    ref={alertEmailRef}
                    className="ftp-alert-input"
                    type="email"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                  <div className="ftp-alert-options">
                    {ALERT_TYPE_OPTIONS.map((option) => (
                      <label className="ftp-alert-check" key={option.value}>
                        <input
                          type="checkbox"
                          checked={alertTypes.includes(option.value)}
                          onChange={() => toggleAlertType(option.value)}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    className="ftp-alert-button"
                    type="submit"
                    disabled={alertLoading || (!alertFlightNumber && !alertCallsign)}
                  >
                    {alertLoading ? t(lang, 'Subscribing...', 'Subscribing...', 'Wird abonniert...') : t(lang, 'Subscribe', 'Subscribe', 'Abonnieren')}
                  </button>
                  {(alertMessage || alertError) && (
                    <div className={`ftp-alert-message${alertError ? ' is-error' : ''}`}>
                      {alertError || alertMessage}
                    </div>
                  )}
                </form>
              </div>

              {/* Book CTA */}
              <Link to="/flights" className="ftp-book-cta">
                {copy.tracker.bookCta} →
              </Link>

              {/* Detail loading state */}
              {detailLoading && (
                <div className="ftp-detail-loading">{copy.tracker.refreshing}</div>
              )}
            </div>
          ) : searchNotFound ? (
            <div className="ftp-not-found">
              <strong>{t(lang, 'No aircraft found.', 'لم يُعثر على طائرة.', 'Kein Flugzeug gefunden.')}</strong>
              <p>{t(lang, 'Try a callsign, flight number, ICAO24, or airport code.', 'جرّب رمز النداء أو رقم الرحلة أو ICAO24 أو رمز المطار.', 'Rufzeichen, Flugnummer, ICAO24 oder Flughafencode versuchen.')}</p>
            </div>
          ) : (
            <div className="ftp-detail-empty">
              <div className="ftp-detail-empty-icon"><IconRadar /></div>
              <div className="ftp-detail-empty-title">
                {t(lang, 'Select an aircraft', 'اختر طائرة', 'Flugzeug auswählen')}
              </div>
              <div className="ftp-detail-empty-hint">{copy.tracker.empty}</div>
              <AdSlot placement="tracker_sidebar_top" metadata={{ region }} />
            </div>
          )}
        </aside>

        {/* ── ERROR / WARNING BANNERS ── */}
        {error && (
          <div className="ftp-alert ftp-alert--error" role="alert">
            <span className="ftp-alert-icon">⚠</span>
            <div className="ftp-alert-body">
              <strong>{t(lang, 'Tracker error', 'خطأ في المتتبع', 'Tracker-Fehler')}</strong>
              {error}
            </div>
          </div>
        )}

        {(tracker?.throttled || tracker?.rateLimited) && !error && (
          <div className="ftp-alert ftp-alert--warning" role="status">
            <span className="ftp-alert-icon">ℹ</span>
            <div className="ftp-alert-body">
              {tracker?.rateLimited
                ? t(lang,
                    'FR24 limit reached. Showing cached/live fallback data.',
                    'تم بلوغ حد FR24. يتم عرض بيانات مخزنة مؤقتاً أو بيانات احتياطية.',
                    'FR24-Limit erreicht. Zeige gecachte oder Fallback-Daten.',
                  )
                : t(lang,
                    'Live updates temporarily throttled. Showing latest cached data.',
                    'تم تقييد التحديثات مؤقتاً. يتم عرض آخر بيانات متاحة.',
                    'Live-Updates vorübergehend gedrosselt. Letzter Cache wird angezeigt.',
                  )
              }
            </div>
          </div>
        )}

        {utilityPanel ? (
          <section className="ftp-utility-panel" aria-live="polite">
            <button
              type="button"
              className="ftp-utility-close"
              onClick={() => setUtilityPanel(null)}
              aria-label="Close tracker utility panel"
            >
              x
            </button>
            {utilityPanel === 'settings' ? (
              <>
                <span className="ftp-section-label">Tracker settings</span>
                <h3>Map workspace</h3>
                <label className="ftp-utility-toggle">
                  <input type="checkbox" checked={filterOpen} onChange={(event) => setFilterOpen(event.target.checked)} />
                  <span>Keep filter panel visible</span>
                </label>
                <label className="ftp-utility-toggle">
                  <input type="checkbox" checked={widgetsOpen} onChange={(event) => setWidgetsOpen(event.target.checked)} />
                  <span>Show insight widgets</span>
                </label>
                <label className="ftp-utility-toggle">
                  <input type="checkbox" checked={compactPanels} onChange={(event) => setCompactPanels(event.target.checked)} />
                  <span>Compact panel spacing</span>
                </label>
              </>
            ) : utilityPanel === 'alerts' ? (
              <>
                <span className="ftp-section-label">Flight alerts</span>
                <h3>Select a flight first</h3>
                <p>Choose an aircraft or search a flight number, then subscribe from the selected flight panel.</p>
                <button type="button" className="ftp-utility-action" onClick={() => setUtilityPanel(null)}>
                  Back to map
                </button>
              </>
            ) : utilityPanel === 'weather' ? (
              <>
                <span className="ftp-section-label">Weather overlay</span>
                <h3>Coming soon</h3>
                <p>Weather overlay is coming soon. Current flight tracking remains available.</p>
              </>
            ) : (
              <>
                <span className="ftp-section-label">Playback</span>
                <h3>Coming soon</h3>
                <p>Playback timeline is coming soon. Live aircraft tracking remains available.</p>
              </>
            )}
          </section>
        ) : null}

        <nav className="ftp-bottom-dock" aria-label="Tracker tools">
          <button type="button" onClick={() => { setUtilityPanel(null); setFilterOpen(prev => !prev); }}>Filters</button>
          <button type="button" onClick={() => { setUtilityPanel(null); setFilterOpen(true); setRegion('global'); }}>Regions</button>
          <button type="button" onClick={() => { setSelectedAc(null); setDetail(null); setDetailOpen(false); navigate('/airports/BER'); }}>Airports</button>
          <button
            type="button"
            onClick={() => {
              if (hasSelectedFlight) {
                setUtilityPanel(null);
                setDetailOpen(true);
                window.setTimeout(() => alertEmailRef.current?.focus(), 0);
              } else {
                setUtilityPanel(current => current === 'alerts' ? null : 'alerts');
              }
            }}
          >
            Alerts
          </button>
          {featureFlags.enableTrackerWeather ? (
            <button type="button" onClick={() => setUtilityPanel(current => current === 'weather' ? null : 'weather')}>Weather</button>
          ) : null}
          {featureFlags.enableTrackerPlayback ? (
            <button type="button" onClick={() => setUtilityPanel(current => current === 'playback' ? null : 'playback')}>Playback</button>
          ) : null}
          <button type="button" onClick={() => setUtilityPanel(current => current === 'settings' ? null : 'settings')}>Settings</button>
        </nav>

        {/* ── LOADING OVERLAY (initial load) ── */}
        {loading && !tracker && (
          <div className="ftp-loading-overlay" aria-hidden="true">
            <div className="ftp-shimmer-stack">
              <div className="ftp-shimmer" style={{ width: '70%' }} />
              <div className="ftp-shimmer" style={{ width: '50%' }} />
              <div className="ftp-shimmer" style={{ width: '62%' }} />
            </div>
          </div>
        )}

        {/* ── MOBILE DETAIL TRIGGER ── */}
        {hasSelectedFlight && !detailOpen && (
          <button
            type="button"
            className="ftp-mobile-fab"
            onClick={() => setDetailOpen(true)}
          >
            ✈ {selectedFlight.callsign || selectedFlight.icao24} ▲
          </button>
        )}

        {/* ── STATUS BAR (bottom) ── */}
        <div className="ftp-status-bar" role="status" aria-live="polite">
          <span className="ftp-live-pill" style={{ height: '26px', padding: '0 8px', fontSize: '0.68rem' }}>
            <i className="ftp-live-dot" aria-hidden="true" style={{ width: '6px', height: '6px' }} />
            {liveText}
          </span>
          <span className="ftp-status-sep" />
          <span className="ftp-status-item"><strong>{summary.total || 0}</strong> {t(lang, 'aircraft', 'طائرة', 'Flugzeuge')}</span>
          <span className="ftp-status-sep" />
          <span className="ftp-status-item">{activeRegionLabel}</span>

          {/* Provider health pills */}
          {showProviderHealth && (
            <>
              <span className="ftp-status-sep" />
              <span className="ftp-status-item ftp-provider-status" title={fr24Ok ? 'Flightradar24 active' : 'FR24 not configured'}>
                <ProviderDot ok={fr24Ok} />FR24
              </span>
              <span className="ftp-status-item ftp-provider-status" title="OpenSky Network active">
                <ProviderDot ok={oskyOk} />OpenSky
              </span>
              {commProvider && commProvider !== 'none' && (
                <span className="ftp-status-item ftp-provider-status" title={commOk ? `${commProvider} active` : `${commProvider} not configured`}>
                  <ProviderDot ok={commOk} />{commProvider}
                </span>
              )}
            </>
          )}

          <span className="ftp-status-spacer" />
          <span className="ftp-status-item">{t(lang, 'Updated', 'تم التحديث', 'Aktualisiert')}: {updatedText}</span>
        </div>

      </div>
      <section className="ftp-seo-faq" aria-labelledby="flight-tracker-faq-title">
        <div className="ftp-seo-faq-inner">
          <h2 id="flight-tracker-faq-title">Flight Tracker FAQ</h2>
          <div className="ftp-seo-faq-grid">
            {trackerFaq.map((item) => (
              <article key={item.question} className="ftp-seo-faq-item">
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
