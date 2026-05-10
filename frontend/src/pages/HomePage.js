import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './HomePage.css';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { API_BASE_URL } from '../apiConfig';

const backgroundImages = ['/plane1.jpg', '/plane2.jpg', '/plane3.jpg'];

const popularRoutes = [
  { from: 'London', to: 'Dubai' },
  { from: 'New York', to: 'Paris' },
  { from: 'Dubai', to: 'Bangkok' },
  { from: 'London', to: 'New York' },
  { from: 'Sydney', to: 'Singapore' },
  { from: 'Paris', to: 'Tokyo' },
];

function track(event, params = {}) {
  if (typeof window.gtag === 'function') window.gtag('event', event, params);
}

const HomePage = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('flights');
  const featuresRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % backgroundImages.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    AOS.init({ duration: 900, once: true });
  }, []);

  return (
    <div className="homepage">

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section
        className="hero"
        style={{ backgroundImage: `url(${backgroundImages[currentImageIndex]})` }}
      >
        <div className="hero-overlay" />
        <div className="hero-inner">
          <div className="hero-text">
            <span className="hero-badge">Trusted Travel Platform</span>
            <h1 className="hero-title">Find &amp; Compare Flight Deals</h1>
            <p className="hero-subtitle">
              Search hundreds of airlines and travel providers to find the best fares worldwide.
            </p>
          </div>

          <div className="search-card">
            <div className="search-tabs" role="tablist">
              <button
                role="tab"
                aria-selected={activeTab === 'flights'}
                className={`search-tab${activeTab === 'flights' ? ' active' : ''}`}
                onClick={() => setActiveTab('flights')}
              >
                ✈ Flights
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'compare'}
                className={`search-tab${activeTab === 'compare' ? ' active' : ''}`}
                onClick={() => setActiveTab('compare')}
              >
                🤝 Partner Deals
              </button>
            </div>

            <div className="search-card-body">
              {activeTab === 'flights' && (
                <div className="search-option">
                  <p className="search-option-desc">
                    Start with Skybridge flight search.
                  </p>
                  <Link
                    to="/flights"
                    className="search-cta-btn"
                    onClick={() => track('search_flight', { source: 'homepage_tab' })}
                  >
                    Search Flights →
                  </Link>
                </div>
              )}
              {activeTab === 'compare' && (
                <div className="search-option">
                  <p className="search-option-desc">
                    Compare flight deals from trusted partner sites. Booking may be
                    completed on the partner website.
                  </p>
                  <Link
                    to="/app-search"
                    className="search-cta-btn"
                    onClick={() => track('click_aviasales', { source: 'homepage_tab' })}
                  >
                    Compare Partner Deals →
                  </Link>
                </div>
              )}

              <div className="search-trust-badges">
                <span>🔒 Secure</span>
                <span>🌍 Global</span>
                <span>💳 No hidden fees</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Affiliate disclosure ───────────────────────────────── */}
      <div className="affiliate-disclosure">
        Some bookings are completed through trusted partner sites. Skybridge may earn a
        commission at no extra cost to you.
      </div>

      {/* ── Trust section ─────────────────────────────────────── */}
      <section className="trust-section" data-aos="fade-up">
        <div className="trust-container">
          <div className="trust-item">
            <span className="trust-icon" aria-hidden="true">🛡️</span>
            <div>
              <strong>Secure Partner Booking</strong>
              <p>All partner sites use industry-standard SSL security.</p>
            </div>
          </div>
          <div className="trust-item">
            <span className="trust-icon" aria-hidden="true">🌐</span>
            <div>
              <strong>Compare Trusted Providers</strong>
              <p>Search across airlines and leading travel aggregators.</p>
            </div>
          </div>
          <div className="trust-item">
            <span className="trust-icon" aria-hidden="true">💰</span>
            <div>
              <strong>No Hidden Fees from Us</strong>
              <p>Skybridge does not add fees on top of partner prices.</p>
            </div>
          </div>
          <div className="trust-item">
            <span className="trust-icon" aria-hidden="true">💬</span>
            <div>
              <strong>Support Available</strong>
              <p>
                <Link to="/contact" className="trust-link">Contact us</Link> if you need help with your booking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Skybridge ─────────────────────────────────────── */}
      <section ref={featuresRef} className="features-section" data-aos="fade-up">
        <div className="features-container">
          <h2>Why Choose Skybridge Flights?</h2>
          <p className="section-subtitle">Everything you need to find the perfect flight — in one place.</p>
          <div className="features-grid">
            <div className="feature-card" data-aos="fade-up" data-aos-delay="100">
              <div className="feature-icon-wrap">
                <img src="/icons/world.svg" alt="Global routes icon" className="feature-icon" />
              </div>
              <h3>Global Routes</h3>
              <p>
                Explore flight options across major cities, airports, and travel
                destinations around the world.
              </p>
            </div>
            <div className="feature-card" data-aos="fade-up" data-aos-delay="200">
              <div className="feature-icon-wrap">
                <img src="/icons/visa.svg" alt="Flight comparison icon" className="feature-icon" />
              </div>
              <h3>Flight Comparison</h3>
              <p>
                Discover flight deals and compare travel options through our
                streamlined flight search experience.
              </p>
            </div>
            <div className="feature-card" data-aos="fade-up" data-aos-delay="300">
              <div className="feature-icon-wrap">
                <img src="/icons/support.svg" alt="Travel inspiration icon" className="feature-icon" />
              </div>
              <h3>Travel Inspiration</h3>
              <p>
                Read destination guides, travel insights, and helpful articles on
                the Skybridge <Link to="/blog" className="trust-link">blog</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Popular routes ────────────────────────────────────── */}
      <section className="popular-section" data-aos="fade-up">
        <div className="popular-container">
          <h2>Popular Routes</h2>
          <p className="popular-subtitle">
            Click any route to start searching for flights.
          </p>
          <div className="popular-grid">
            {popularRoutes.map((route, i) => (
              <Link
                key={i}
                to="/flights"
                className="popular-route-card"
                aria-label={`Search flights from ${route.from} to ${route.to}`}
                onClick={() => track('search_flight', { from: route.from, to: route.to })}
                data-aos="fade-up"
                data-aos-delay={i * 50}
              >
                <span className="route-from">{route.from}</span>
                <span className="route-arrow">→</span>
                <span className="route-to">{route.to}</span>
              </Link>
            ))}
          </div>
          <div className="popular-cta-row">
            <Link
              to="/flights"
              className="popular-browse-btn"
              onClick={() => track('search_flight', { source: 'popular_browse' })}
            >
              Browse All Flights
            </Link>
            <Link
              to="/blog"
              className="popular-blog-btn"
            >
              Read Travel Guides
            </Link>
          </div>
        </div>
      </section>

      {/* ── Reviews ───────────────────────────────────────────── */}
      <ReviewsSection />

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="site-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <strong>Skybridge Flights</strong>
            <p>Compare flight deals from trusted travel providers worldwide.</p>
          </div>
          <nav className="footer-links" aria-label="Footer navigation">
            <Link to="/about">About</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/blog">Blog</Link>
            <Link to="/flights">Search Flights</Link>
            <Link to="/flight-tracker">Flight Tracker</Link>
            <Link to="/airports/BER">Airport Intelligence</Link>
          </nav>
          <p className="footer-disclosure">
            Skybridge Flights is an affiliate travel platform. Some links may earn us
            a commission at no extra cost to you. Prices are set by partner providers.
          </p>
          <p className="footer-copy">© {new Date().getFullYear()} Skybridge Flights. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

/* ─── Reviews Section (unchanged logic) ───────────────────────── */
const ReviewsSection = () => {
  const [reviews, setReviews] = useState([]);
  const [newReview, setNewReview] = useState({ name: '', comment: '', rating: 0 });
  const [sort, setSort] = useState('highest');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });

  const token =
    localStorage.getItem('token') || localStorage.getItem('staffToken');

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch (_) {
      return null;
    }
  }, []);

  const canDeleteReview =
    currentUser?.email === 'SkybridgeFlights@gmail.com' ||
    currentUser?.isAdmin === true ||
    String(currentUser?.role || '').toLowerCase() === 'admin';

  const fetchReviews = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/reviews`);
      let sorted = [...res.data];
      if (sort === 'highest') sorted.sort((a, b) => b.rating - a.rating);
      else if (sort === 'lowest') sorted.sort((a, b) => a.rating - b.rating);
      else if (sort === 'newest') sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      else if (sort === 'oldest') sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      else if (sort.includes('stars')) sorted = sorted.filter((r) => r.rating === parseInt(sort[0], 10));
      setReviews(sorted);
    } catch (err) {
      console.error('Failed to fetch reviews', err);
    }
  }, [sort]);

  useEffect(() => {
    fetchReviews();
    AOS.refresh();
  }, [fetchReviews]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNotice({ type: '', text: '' });
    if (!newReview.rating || !newReview.name.trim() || !newReview.comment.trim()) {
      setNotice({ type: 'error', text: 'Please enter your name, comment, and rating.' });
      return;
    }
    try {
      setSubmitting(true);
      await axios.post(`${API_BASE_URL}/api/reviews`, {
        name: newReview.name.trim(),
        comment: newReview.comment.trim(),
        rating: newReview.rating,
      });
      setNewReview({ name: '', comment: '', rating: 0 });
      setNotice({ type: 'success', text: 'Review submitted successfully.' });
      await fetchReviews();
    } catch (err) {
      console.error('Failed to submit review', err);
      setNotice({ type: 'error', text: err?.response?.data?.error || 'Failed to submit review.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!canDeleteReview) return;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      await axios.delete(`${API_BASE_URL}/api/reviews/${id}`, { headers });
      setNotice({ type: 'success', text: 'Review deleted successfully.' });
      await fetchReviews();
    } catch (err) {
      console.error('Failed to delete review', err);
      setNotice({ type: 'error', text: err?.response?.data?.error || 'Failed to delete review.' });
    }
  };

  return (
    <section className="reviews-section" data-aos="fade-up">
      <div className="reviews-container">
        <h2>Traveler Reviews</h2>

        <div className="sort-container">
          <label htmlFor="sort">Sort by:</label>
          <select id="sort" className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="highest">Highest Rating</option>
            <option value="lowest">Lowest Rating</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="5stars">5 Stars</option>
            <option value="4stars">4 Stars</option>
            <option value="3stars">3 Stars</option>
            <option value="2stars">2 Stars</option>
            <option value="1stars">1 Star</option>
          </select>
        </div>

        {notice.text && (
          <div className={`review-notice ${notice.type === 'error' ? 'review-notice-error' : 'review-notice-success'}`}>
            {notice.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="review-form" data-aos="fade-up">
          <div className="stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                onClick={() => setNewReview((prev) => ({ ...prev, rating: n }))}
                style={{ cursor: 'pointer', color: newReview.rating >= n ? 'gold' : '#9ca3af', fontSize: '30px' }}
              >
                ★
              </span>
            ))}
          </div>
          <input
            type="text"
            placeholder="Your name"
            value={newReview.name}
            onChange={(e) => setNewReview((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <textarea
            placeholder="Write your review..."
            value={newReview.comment}
            onChange={(e) => setNewReview((prev) => ({ ...prev, comment: e.target.value }))}
            required
          />
          <button className="review-submit-btn" type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </form>

        <div className="reviews-list">
          {reviews.map((r) => (
            <div key={r._id} className="review-item" data-aos="fade-up">
              <div className="rating">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
              <div className="name">{r.name || r.user?.name || 'Anonymous'}</div>
              <p>{r.comment}</p>
              {canDeleteReview && (
                <button onClick={() => handleDelete(r._id)} className="delete-review-btn">
                  Delete
                </button>
              )}
            </div>
          ))}
          {reviews.length === 0 && (
            <div className="review-item">
              <div className="name">No reviews yet</div>
              <p>Be the first traveler to share your experience.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default HomePage;
