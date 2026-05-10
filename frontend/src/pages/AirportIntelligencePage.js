import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useParams } from 'react-router-dom';
import { API_BASE_URL } from '../apiConfig';
import TrackerMap from '../components/tracker/TrackerMap';
import AdSlot from '../components/monetization/AdSlot';
import { getTrackerCopy, getTrackerDirection, useSiteLanguage, withTrackerLanguage } from '../utils/trackerLanguage';
import { trackEvent } from '../utils/analytics';
import './AirportIntelligencePage.css';

const FEATURED_AIRPORTS = ['BER', 'FRA', 'MUC', 'IST', 'SAW', 'DXB', 'BEY'];

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

function setAlternateLanguages(baseUrl, currentPath, language) {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('link[data-airport-hreflang="true"]').forEach((node) => node.remove());
  ['en', 'ar', 'de'].forEach((lang) => {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = lang;
    link.href = `${baseUrl}${currentPath}?lang=${lang}`;
    link.setAttribute('data-airport-hreflang', 'true');
    document.head.appendChild(link);
  });
  const defaultLink = document.createElement('link');
  defaultLink.rel = 'alternate';
  defaultLink.hreflang = 'x-default';
  defaultLink.href = `${baseUrl}${currentPath}`;
  defaultLink.setAttribute('data-airport-hreflang', 'true');
  document.head.appendChild(defaultLink);
  document.documentElement.lang = language;
  document.documentElement.dir = getTrackerDirection(language);
}

function formatSpeed(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
  return `${Math.round(Number(value) * 3.6)} km/h`;
}

function formatAltitude(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
  return `${Math.round(Number(value))} m`;
}

function airportMeta(airportCode = '') {
  const code = String(airportCode || '').toUpperCase();
  const map = {
    BER: 'Berlin Brandenburg Airport',
    FRA: 'Frankfurt Airport',
    MUC: 'Munich Airport',
    IST: 'Istanbul Airport',
    SAW: 'Sabiha Gokcen Airport',
    DXB: 'Dubai International Airport',
    BEY: 'Beirut Rafic Hariri International Airport',
  };
  return map[code] || `${code} Airport`;
}

function airportTimezone(airportCode = '') {
  const code = String(airportCode || '').toUpperCase();
  const map = {
    BER: 'Europe/Berlin',
    FRA: 'Europe/Berlin',
    MUC: 'Europe/Berlin',
    IST: 'Europe/Istanbul',
    SAW: 'Europe/Istanbul',
    DXB: 'Asia/Dubai',
    BEY: 'Asia/Beirut',
    LHR: 'Europe/London',
  };
  return map[code] || 'Available when provider data includes timezone';
}

function normalizeMessage(error) {
  return error?.response?.data?.message || error?.message || 'Unable to load airport intelligence.';
}

export default function AirportIntelligencePage() {
  const { airportCode: paramCode } = useParams();
  const language = useSiteLanguage('en');
  const copy = getTrackerCopy(language);
  const airportCode = String(paramCode || 'BER').trim().toUpperCase();
  const [airport, setAirport] = useState(null);
  const [blogPosts, setBlogPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const title = `${airport?.airportName || airportMeta(airportCode)} | Skybridge Flights`;
    const description =
      language === 'ar'
        ? `معلومات المطار المباشرة لـ ${airportMeta(airportCode)}، مع الطائرات القريبة ونصائح الانتقال والأمتعة.`
        : language === 'de'
          ? `Flughafeninfos für ${airportMeta(airportCode)} mit Live-Flugzeugen, Transfer- und Gepäcktipps.`
          : `Airport intelligence for ${airportMeta(airportCode)} with live aircraft, transfer tips, baggage guidance, and booking support.`;
    const siteUrl = getSiteUrl();
    const seoTitle = `Live flights and airport information for ${airportCode} | Skybridge Flights`;
    const seoDescription = `Live flights and airport information for ${airportCode}, including nearby aircraft, arrivals, airport guidance and route context.`;
    void title;
    void description;
    document.title = seoTitle;
    setCanonical(`${siteUrl}/airports/${airportCode || 'BER'}`);
    setMeta('description', seoDescription);
    setMeta('og:title', seoTitle, 'property');
    setMeta('og:description', seoDescription, 'property');
    setMeta('og:url', `${siteUrl}/airports/${airportCode || 'BER'}`, 'property');
    setMeta('og:type', 'website', 'property');
    setMeta('robots', 'index,follow');
    setAlternateLanguages(siteUrl, `/airports/${airportCode || 'BER'}`, language);
  }, [airport, airportCode, language]);

  useEffect(() => {
    let active = true;
    const fetchAirport = async () => {
      try {
        setLoading(true);
        setError('');
        const { data } = await axios.get(
          `${API_BASE_URL}/api/flight-tracker/airport/${encodeURIComponent(airportCode || 'BER')}`,
          { params: { lang: language } }
        );
        if (!active) return;
        setAirport(data);
      } catch (err) {
        if (!active) return;
        setError(normalizeMessage(err));
        setAirport(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchAirport();
    return () => {
      active = false;
    };
  }, [airportCode, language]);

  useEffect(() => {
    const fetchBlogPosts = async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/blog?language=${encodeURIComponent(language)}`);
        setBlogPosts(Array.isArray(data) ? data : []);
      } catch (_) {
        setBlogPosts([]);
      }
    };
    fetchBlogPosts();
  }, [language]);

  const schema = useMemo(() => {
    const siteUrl = getSiteUrl();
    const airportName = airport?.airportName || airportMeta(airportCode);
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          name: `Live flights and airport information for ${airportCode}`,
          description: `Live flights and airport information for ${airportCode}.`,
          url: `${siteUrl}/airports/${airportCode || 'BER'}`,
          inLanguage: language,
          mainEntity: { '@id': `${siteUrl}/airports/${airportCode || 'BER'}#airport` },
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Flight Tracker', item: `${siteUrl}/flight-tracker` },
            { '@type': 'ListItem', position: 3, name: airportCode, item: `${siteUrl}/airports/${airportCode || 'BER'}` },
          ],
        },
        {
          '@type': 'Airport',
          '@id': `${siteUrl}/airports/${airportCode || 'BER'}#airport`,
          name: airportName,
          identifier: airportCode,
          iataCode: airportCode,
          icaoCode: airport?.airport?.icaoCode,
          address: airport?.airport?.country ? { '@type': 'PostalAddress', addressCountry: airport.airport.country } : undefined,
          geo: airport?.airport?.latitude && airport?.airport?.longitude
            ? { '@type': 'GeoCoordinates', latitude: airport.airport.latitude, longitude: airport.airport.longitude }
            : undefined,
        },
      ],
    };
  }, [airport, airportCode, language]);

  const liveAircraft = Array.isArray(airport?.liveAircraft)
    ? airport.liveAircraft
    : Array.isArray(airport?.aircraft)
      ? airport.aircraft
      : [];
  const summary = airport?.summary || {
    totalAircraft: liveAircraft.length,
    airborne: liveAircraft.filter((item) => !item.onGround).length,
    onGround: liveAircraft.filter((item) => item.onGround).length,
  };
  const airportCenter =
    airport?.airport?.center ||
    (airport?.airport ? [airport.airport.latitude, airport.airport.longitude] : [51.2, 10.3]);
  const airportZoom = airport?.airport ? 7 : 5;
  const relatedBlogs = blogPosts
    .filter((post) => {
      const haystack = `${post.title} ${post.excerpt} ${post.category}`.toLowerCase();
      return [
        airportCode.toLowerCase(),
        airportMeta(airportCode).toLowerCase(),
        airport?.airport?.city?.toLowerCase(),
        airport?.airport?.country?.toLowerCase(),
      ]
        .filter(Boolean)
        .some((needle) => haystack.includes(needle));
    })
    .slice(0, 4);
  const commercial = airport?.commercial || {};
  const hasCommercial = !!commercial.available && (commercial.arrivals.length > 0 || commercial.departures.length > 0);
  const timezone = airport?.airport?.timezone || airportTimezone(airportCode);
  const trackerRegionUrl = withTrackerLanguage(`/flight-tracker?region=${encodeURIComponent(airport?.airport?.region || 'global')}`, language);

  return (
    <div className="airport-page" dir={getTrackerDirection(language)} lang={language}>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>

      <section className="airport-hero">
        <div>
          <span className="airport-kicker">Skybridge Flights</span>
          <h1>{airport?.airportName || airportMeta(airportCode)}</h1>
          <p>
            {language === 'ar'
              ? `الطائرات القريبة ونصائح الانتقال والأمتعة وخيارات الحجز لـ ${airportCode || 'BER'} في صفحة واحدة.`
              : language === 'de'
                ? `Nahe Flugzeuge, Transferhinweise, Gepäcktipps und Buchungskontext für ${airportCode || 'BER'} auf einer Seite.`
                : `Live aircraft near ${airportCode || 'the selected airport'}, transfer tips, baggage guidance, and booking support in one place.`}
          </p>
        </div>
        <div className="airport-hero-card">
          <strong>{airportCode || 'BER'}</strong>
          <span>{[airport?.airport?.city, airport?.airport?.country].filter(Boolean).join(', ') || 'Airport details loading'}</span>
          <span className="airport-provider-note">Live nearby aircraft by OpenSky</span>
          {airport?.source ? <small className="airport-provider-debug">Recent live snapshot</small> : null}
        </div>
      </section>

      <section className="airport-action-strip" aria-label="Airport actions">
        <Link to={withTrackerLanguage('/flight-tracker', language)}>Open full tracker</Link>
        <Link to={trackerRegionUrl}>Track flights near this airport</Link>
        <Link
          to={withTrackerLanguage(`/flights?airport=${encodeURIComponent(airportCode)}&intent=transfer`, language)}
          onClick={() => trackEvent('booking_search_click', { metadata: { source: 'airport_transfer_cta', airportCode } })}
        >
          Airport transfer
        </Link>
        <Link
          to={withTrackerLanguage(`/flights?airport=${encodeURIComponent(airportCode)}&intent=hotel`, language)}
          onClick={() => trackEvent('hotel_click', { metadata: { source: 'airport_hotel_cta', airportCode } })}
        >
          Hotels near airport
        </Link>
      </section>

      <section className="airport-map-card">
        <div className="airport-card-head">
          <div>
            <span className="airport-section-label">{copy.tracker.liveMap}</span>
            <h2>{language === 'ar' ? 'الخريطة المباشرة حول المطار' : language === 'de' ? 'Live-Karte rund um den Flughafen' : `Live map around ${airportCode || 'the airport'}`}</h2>
          </div>
          <Link to={withTrackerLanguage('/flight-tracker', language)}>{copy.tracker.openTracker}</Link>
        </div>
        <div className="airport-map-stage">
          <TrackerMap
            aircraft={liveAircraft.slice(0, 48)}
            center={airportCenter}
            zoom={airportZoom}
            onSelectAircraft={() => {}}
            airport={airport?.airport}
          />
        </div>
      </section>

      {error ? <div className="airport-alert">{error}</div> : null}

      <section className="airport-stats">
        <article>
          <strong>{summary.totalAircraft || 0}</strong>
          <span>{copy.tracker.nearbyAircraft}</span>
        </article>
        <article>
          <strong>{summary.airborne || 0}</strong>
          <span>{copy.tracker.statusAirborne}</span>
        </article>
        <article>
          <strong>{summary.onGround || 0}</strong>
          <span>{copy.tracker.statusGround}</span>
        </article>
        <article>
          <strong>{airport?.airport?.region || 'global'}</strong>
          <span>{language === 'ar' ? 'نطاق التغطية' : language === 'de' ? 'Abdeckungsbereich' : 'Coverage region'}</span>
        </article>
      </section>

      <section className="airport-section">
        <div className="airport-card-head">
          <div>
            <span className="airport-section-label">{language === 'ar' ? 'اختصارات المطارات' : language === 'de' ? 'Flughafenkürzel' : 'Airport shortcuts'}</span>
            <h2>{language === 'ar' ? 'المطارات الأكثر استخدامًا' : language === 'de' ? 'Meistgenutzte Flughäfen' : 'Common airports'}</h2>
          </div>
        </div>
        <div className="airport-chip-row">
          {FEATURED_AIRPORTS.map((code) => (
            <Link key={code} to={withTrackerLanguage(`/airports/${code}`, language)}>
              {code}
            </Link>
          ))}
        </div>
      </section>

      <section className="airport-section">
        <div className="airport-card-head">
          <div>
            <span className="airport-section-label">{copy.tracker.airportFacts}</span>
            <h2>{language === 'ar' ? 'الموقع والسياق' : language === 'de' ? 'Lage und Kontext' : 'Location and travel context'}</h2>
          </div>
        </div>
        <div className="airport-facts">
          <article>
            <strong>{airport?.airport?.city || 'City'}</strong>
            <span>{language === 'ar' ? 'المدينة' : language === 'de' ? 'Stadt' : 'City'}</span>
          </article>
          <article>
            <strong>{airport?.airport?.country || 'Country'}</strong>
            <span>{language === 'ar' ? 'الدولة' : language === 'de' ? 'Land' : 'Country'}</span>
          </article>
          <article>
            <strong>{airport?.airport?.icaoCode || airportCode || 'ICAO'}</strong>
            <span>ICAO</span>
          </article>
          <article>
            <strong>{airport?.airport?.airportCode || airportCode || 'IATA'}</strong>
            <span>IATA</span>
          </article>
          <article>
            <strong>{timezone}</strong>
            <span>{language === 'ar' ? 'Ø§Ù„Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ø²Ù…Ù†ÙŠØ©' : language === 'de' ? 'Zeitzone' : 'Timezone'}</span>
          </article>
        </div>
      </section>

      <section className="airport-layout">
        <div className="airport-main-card">
          <div className="airport-card-head">
            <div>
              <span className="airport-section-label">{copy.tracker.nearbyAircraft}</span>
              <h2>{language === 'ar' ? 'الطائرات القريبة' : language === 'de' ? 'Nahe Flugzeuge' : 'Nearby aircraft'}</h2>
            </div>
            <Link to={withTrackerLanguage('/flight-tracker', language)}>{copy.tracker.openTracker}</Link>
          </div>

          {loading ? (
            <p className="airport-empty">
              {language === 'ar'
                ? 'جاري تحميل معلومات المطار...'
                : language === 'de'
                  ? 'Flughafeninformationen werden geladen...'
                  : 'Loading airport intelligence...'}
            </p>
          ) : liveAircraft.length ? (
            <div className="airport-flight-list">
              {liveAircraft.slice(0, 12).map((item) => (
                <article key={item.icao24} className="airport-flight-row">
                  <div>
                    <strong>{item.callsign || item.icao24}</strong>
                    <span>{item.originCountry || 'Unknown country'}</span>
                  </div>
                  <div>
                    <strong>{formatAltitude(item.geoAltitude ?? item.baroAltitude)}</strong>
                    <span>{formatSpeed(item.velocity)}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="airport-empty">
              {language === 'ar'
                ? 'لم يتم إرجاع طائرات قريبة في اللقطة الحالية.'
                : language === 'de'
                  ? 'Im aktuellen Snapshot wurden keine nahen Flugzeuge zurückgegeben.'
                  : 'No nearby aircraft were returned in the current snapshot.'}
            </p>
          )}
        </div>

        <aside className="airport-side-card">
          <div className="airport-card-head">
            <div>
              <span className="airport-section-label">{copy.tracker.travelGuidance}</span>
              <h2>{language === 'ar' ? 'نصائح السفر' : language === 'de' ? 'Reisehinweise' : 'Travel tips'}</h2>
            </div>
          </div>
          <div className="airport-tip">
            <h3>{copy.tracker.transferTips}</h3>
            <p>{(airport?.transferTips || ['Plan extra time for ground transfers and late arrivals.']).join(' ')}</p>
          </div>
          <div className="airport-tip">
            <h3>{copy.tracker.baggageTips}</h3>
            <p>{(airport?.baggageTips || ['Check baggage rules and cabin bag size before booking.']).join(' ')}</p>
          </div>
          <div className="airport-tip">
            <h3>{language === 'ar' ? 'المسارات الشائعة' : language === 'de' ? 'Beliebte Routen' : 'Related routes'}</h3>
            <div className="airport-route-links">
              {(airport?.relatedRoutes || []).slice(0, 4).map((route) => (
                <span key={route}>{route}</span>
              ))}
              {!airport?.relatedRoutes?.length ? <span>Popular routes shown after data loads.</span> : null}
            </div>
          </div>
          {hasCommercial ? (
            <div className="airport-tip">
              <h3>{language === 'ar' ? 'الجداول التجارية' : language === 'de' ? 'Kommerzielle Flugpläne' : 'Commercial schedules'}</h3>
              <p>
                {language === 'ar'
                  ? 'تتوفر بيانات الرحلات المجدولة لهذه الوجهة من المزود التجاري الحالي.'
                  : language === 'de'
                    ? 'Für dieses Ziel sind geplante Flugdaten vom aktuellen kommerziellen Anbieter verfügbar.'
                    : 'Scheduled flight data is available for this airport from the current commercial provider.'}
              </p>
              <div className="airport-route-links">
                {commercial.departures.slice(0, 3).map((item) => (
                  <span key={`dep-${item.flightNumber}`}>{item.flightNumber || item.callsign || 'DEP'}</span>
                ))}
                {commercial.arrivals.slice(0, 3).map((item) => (
                  <span key={`arr-${item.flightNumber}`}>{item.flightNumber || item.callsign || 'ARR'}</span>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </section>

      <section className="airport-section">
        <div className="airport-card-head">
          <div>
            <span className="airport-section-label">{copy.tracker.relatedArticles}</span>
            <h2>{language === 'ar' ? 'مقالات السفر ذات الصلة' : language === 'de' ? 'Verwandte Reiseartikel' : 'Travel articles for this airport'}</h2>
          </div>
        </div>
        <div className="airport-blog-grid">
          {relatedBlogs.length ? (
            relatedBlogs.map((post) => (
              <article key={post._id || post.slug} className="airport-blog-card">
                <span>{post.category || 'Travel'}</span>
                <strong>{post.title}</strong>
                <p>{post.excerpt || post.metaDescription || 'Read more travel guidance on Skybridge Flights.'}</p>
                <Link to={post.language && post.language !== 'en' ? `/blog/${post.language}/${post.slug}` : `/blog/${post.slug}`}>
                  {language === 'ar' ? 'اقرأ المقال' : language === 'de' ? 'Artikel lesen' : 'Read article'}
                </Link>
              </article>
            ))
          ) : (
            <p className="airport-empty">
              {language === 'ar'
                ? 'ستظهر المقالات ذات الصلة هنا عندما تتوفر محتويات سفر متطابقة.'
                : language === 'de'
                  ? 'Passende Artikel erscheinen hier, sobald Reisekontent verfügbar ist.'
                  : 'Related articles will appear here once matching travel content is available.'}
            </p>
          )}
        </div>
      </section>

      <AdSlot placement="airport_page_inline" metadata={{ airportCode }} />

      <section className="airport-section airport-cta">
        <div>
          <span className="airport-section-label">Skybridge Flights</span>
          <h2>{language === 'ar' ? 'احجز رحلاتك وفنادقك وسياراتك بثقة' : language === 'de' ? 'Buchen Sie Flüge, Hotels und Mietwagen mit Vertrauen' : 'Book flights, hotels, and cars with confidence'}</h2>
          <p>
            {language === 'ar'
              ? 'انتقل من التخطيط للمطار إلى الحجز مباشرة عبر Skybridge Flights.'
              : language === 'de'
                ? 'Wechseln Sie von der Flughafenplanung direkt zur Buchung mit Skybridge Flights.'
                : 'Move from airport planning to booking with Skybridge Flights for flights, hotels, and car rental support.'}
          </p>
        </div>
        <div className="airport-cta-actions">
          <Link
            to={withTrackerLanguage('/flights', language)}
            onClick={() => trackEvent('booking_search_click', { metadata: { source: 'airport_cta', airportCode } })}
          >
            {language === 'ar' ? 'ابحث عن الرحلات' : language === 'de' ? 'Flüge suchen' : 'Search flights'}
          </Link>
          <Link to={withTrackerLanguage('/blog', language)}>{language === 'ar' ? 'اقرأ الأدلة' : language === 'de' ? 'Reiseführer lesen' : 'Read travel guides'}</Link>
        </div>
      </section>
    </div>
  );
}
