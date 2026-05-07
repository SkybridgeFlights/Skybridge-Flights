// Lightweight GA4 helper. No-op if REACT_APP_GA_MEASUREMENT_ID is not set.
const GA_ID = process.env.REACT_APP_GA_MEASUREMENT_ID;
let initialized = false;

export function initAnalytics() {
  if (initialized || !GA_ID) return;
  initialized = true;

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
  if (!GA_ID || typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}
