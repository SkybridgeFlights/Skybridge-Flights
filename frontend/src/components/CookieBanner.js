import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './CookieBanner.css';

const CONSENT_KEY = 'cookieConsent';

function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setVisible(false);
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'accept_cookies');
    }
  };

  const reject = () => {
    localStorage.setItem(CONSENT_KEY, 'rejected');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie consent">
      <div className="cookie-banner-text">
        <h3>🍪 We use cookies</h3>
        <p>
          We use cookies to improve your experience and track affiliate partner
          referrals. By clicking Accept, you consent to our use of cookies.
          For more information, see our{' '}
          <Link to="/privacy" className="cookie-policy-link">Privacy Policy</Link>.
        </p>
      </div>
      <div className="cookie-banner-actions">
        <button className="cookie-accept-btn" onClick={accept}>Accept</button>
        <button className="cookie-reject-btn" onClick={reject}>Reject</button>
      </div>
    </div>
  );
}

export default CookieBanner;
