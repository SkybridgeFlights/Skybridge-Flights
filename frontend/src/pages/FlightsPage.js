import React, { useEffect } from 'react';
import './FlightsPage.css';

function FlightsPage() {
  useEffect(() => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', { page_path: '/flights' });
    }
  }, []);

  return (
    <div className="flights-page">

      {/* ── Compact info bar ──────────────────────────────────── */}
      <div className="flights-info-bar">
        <div className="flights-info-inner">
          <div className="flights-info-left">
            <h1 className="flights-page-title">Search Flights</h1>
            <p className="flights-page-subtitle">
              Compare deals from trusted partner providers.
            </p>
          </div>
          <p className="flights-disclosure">
            Some bookings are completed through trusted partner sites.
            Skybridge may earn a commission at no extra cost to you.
          </p>
        </div>
      </div>

      {/* ── Partner flight search widget ──────────────────────── */}
      {/* iframe src and all affiliate/tracking parameters are unchanged */}
      <div className="flights-widget-wrapper">
        <iframe
          src="https://flights.skybridgeflights.com"
          title="Search Flights — powered by trusted partner technology"
          className="flights-iframe"
          loading="lazy"
        />
      </div>

    </div>
  );
}

export default FlightsPage;
