import { API_BASE_URL } from '../apiConfig';
import { hasConsent } from './consent';

// Lightweight GA4 helper plus first-party internal analytics.
const GA_ID = process.env.REACT_APP_GA_MEASUREMENT_ID;
let initialized = false;
let lastPageViewKey = '';

function safeStorageGet(key) {
  try { return window.localStorage.getItem(key); } catch (_) { return null; }
}

function safeStorageSet(key, value) {
  try { window.localStorage.setItem(key, value); } catch (_) {}
}

function makeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function getVisitorId() {
  let id = safeStorageGet('skybridgeVisitorId');
  if (!id) {
    id = makeId('v');
    safeStorageSet('skybridgeVisitorId', id);
  }
  return id;
}

function getSessionId() {
  let id = window.sessionStorage?.getItem('skybridgeSessionId');
  if (!id) {
    id = makeId('s');
    try { window.sessionStorage.setItem('skybridgeSessionId', id); } catch (_) {}
  }
  return id;
}

function classifyPage(path = '') {
  if (path === '/flight-tracker' || path.startsWith('/live-flights/')) return 'tracker_view';
  if (path.startsWith('/airports/')) return 'airport_page_view';
  if (path.startsWith('/blog/')) return 'blog_view';
  return 'page_view';
}

export function initAnalytics() {
  if (initialized) return;
  initialized = true;

  if (!GA_ID) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID, { send_page_view: true });
}

export function trackEvent(name, params = {}) {
  if (!hasConsent('analytics')) return;

  if (GA_ID && typeof window.gtag === 'function') {
    window.gtag('event', name, params);
  }

  const payload = {
    eventType: name,
    path: params.path || `${window.location.pathname}${window.location.search || ''}`,
    pageTitle: params.pageTitle || document.title || '',
    referrer: document.referrer || '',
    source: params.source || '',
    sessionId: getSessionId(),
    visitorId: getVisitorId(),
    metadata: params.metadata || {},
  };

  const url = `${API_BASE_URL}/api/analytics/event`;
  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
      return;
    }
  } catch (_) {}

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}

export function trackPageView(location) {
  const path = `${location?.pathname || window.location.pathname}${location?.search || window.location.search || ''}`;
  const key = `${path}:${document.title || ''}`;
  if (lastPageViewKey === key) return;
  lastPageViewKey = key;

  const pagePath = location?.pathname || window.location.pathname;
  const eventType = classifyPage(pagePath);
  const metadata = {};
  if (pagePath.startsWith('/airports/')) metadata.airportCode = pagePath.split('/').filter(Boolean)[1] || '';
  if (pagePath.startsWith('/live-flights/')) metadata.flightNumber = pagePath.split('/').filter(Boolean)[1] || '';

  trackEvent(eventType, { path, pageTitle: document.title, metadata });
}
