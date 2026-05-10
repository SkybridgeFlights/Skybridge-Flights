const CONSENT_KEY = 'skybridgeConsentState';

const defaultConsent = {
  analytics: process.env.REACT_APP_ANALYTICS_REQUIRE_CONSENT === 'true' ? 'pending' : 'granted',
  ads: 'pending',
  marketing: 'pending',
};

function readStoredConsent() {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CONSENT_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

export function getConsentState() {
  return { ...defaultConsent, ...readStoredConsent() };
}

export function hasConsent(type) {
  return getConsentState()[type] === 'granted';
}

export function setConsentState(next = {}) {
  if (typeof window === 'undefined') return getConsentState();
  const merged = { ...getConsentState(), ...next };
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent('skybridge-consent-change', { detail: merged }));
  } catch (_) {}
  return merged;
}

export function subscribeConsent(listener) {
  if (typeof window === 'undefined') return () => {};
  const handler = (event) => listener(event.detail || getConsentState());
  window.addEventListener('skybridge-consent-change', handler);
  return () => window.removeEventListener('skybridge-consent-change', handler);
}
