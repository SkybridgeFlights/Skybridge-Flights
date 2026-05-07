import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useLocation, useParams } from 'react-router-dom';
import { API_BASE_URL } from '../apiConfig';
import './SeoLandingPage.css';

function setMeta(name, content, attr = 'name') {
  if (!content) return;
  let meta = document.querySelector(`meta[${attr}="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attr, name);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function SeoLandingPage() {
  const { slug } = useParams();
  const location = useLocation();
  const [page, setPage] = useState(null);
  const [hreflang, setHreflang] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const trackedRef = useRef(false);

  const language = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('lang') || 'en';
  }, [location.search]);

  useEffect(() => {
    const fetchPage = async () => {
      try {
        setLoading(true);
        setError('');
        trackedRef.current = false;
        const { data } = await axios.get(
          `${API_BASE_URL}/api/blog/seo-pages/public/${encodeURIComponent(slug)}?language=${encodeURIComponent(language)}&path=${encodeURIComponent(location.pathname)}`
        );
        setPage(data.page || null);
        setHreflang(Array.isArray(data.hreflang) ? data.hreflang : []);
      } catch (err) {
        console.error('Failed to load SEO page:', err);
        setError('This travel guide is not available yet.');
      } finally {
        setLoading(false);
      }
    };
    fetchPage();
  }, [slug, language, location.pathname]);

  useEffect(() => {
    if (!page) return;
    document.title = page.metaTitle || page.title;
    setMeta('description', page.metaDescription);
    setMeta('og:title', page.metaTitle || page.title, 'property');
    setMeta('og:description', page.metaDescription, 'property');
    setMeta('og:type', 'website', 'property');
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = page.canonicalUrl || `${window.location.origin}${page.path}`;
    document.querySelectorAll('link[data-seo-hreflang="true"]').forEach((item) => item.remove());
    hreflang.forEach((item) => {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = item.language;
      link.href = item.url;
      link.setAttribute('data-seo-hreflang', 'true');
      document.head.appendChild(link);
    });
  }, [page, hreflang]);

  useEffect(() => {
    if (!page || trackedRef.current) return;
    trackedRef.current = true;
    axios.post(`${API_BASE_URL}/api/blog/seo-pages/public/${page._id}/view`).catch(() => {});
  }, [page]);

  const trackCta = () => {
    if (!page) return;
    axios.post(`${API_BASE_URL}/api/blog/seo-pages/public/${page._id}/cta-click`).catch(() => {});
  };

  if (loading) return <div className="seo-page"><p className="seo-state">Loading...</p></div>;
  if (error || !page) return <div className="seo-page"><p className="seo-state error">{error}</p></div>;

  return (
    <div className="seo-page" dir={page.language === 'ar' ? 'rtl' : 'ltr'}>
      <section className="seo-hero">
        <div>
          <span>{page.service || page.pageType}</span>
          <h1>{page.title}</h1>
          <p>{page.metaDescription}</p>
          <Link to="/flights" onClick={trackCta}>Search flights</Link>
        </div>
      </section>

      <section className="seo-sections">
        {(page.sections || []).map((section, index) => (
          <article key={`${section.heading}-${index}`}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>

      {(page.faq || []).length ? (
        <section className="seo-faq">
          <h2>FAQ</h2>
          {page.faq.map((item, index) => (
            <details key={`${item.question}-${index}`}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </section>
      ) : null}

      <section className="seo-cta">
        <div>
          <strong>Continue with Skybridge Flights</strong>
          <p>Compare travel options, review routes, and move from planning to booking when ready.</p>
        </div>
        <Link to="/flights" onClick={trackCta}>Compare options</Link>
      </section>

      {page.schemaMarkup ? (
        <script type="application/ld+json">{JSON.stringify(page.schemaMarkup)}</script>
      ) : null}
    </div>
  );
}

export default SeoLandingPage;
