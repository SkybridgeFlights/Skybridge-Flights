import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';
import './ManageReviewsPage.css';

export default function ManageReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({
    totalReviews: 0,
    ratings: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [query, setQuery] = useState('');

  const token = localStorage.getItem('token') || localStorage.getItem('staffToken');

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const load = async () => {
    setLoading(true);
    setNotice({ type: '', text: '' });

    try {
      const [reviewsRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/reviews`),
        axios.get(`${API_BASE_URL}/api/reviews/stats`, { headers }),
      ]);

      setReviews(reviewsRes.data || []);
      setStats(
        statsRes.data || {
          totalReviews: 0,
          ratings: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        }
      );
    } catch (e) {
      console.error('load reviews error:', e);
      setNotice({
        type: 'error',
        text: e.response?.data?.error || 'Failed to load reviews.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reviews;

    return reviews.filter((r) =>
      [r.name, r.comment, r.user?.email, r.user?.name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [reviews, query]);

  const remove = async (id) => {
    if (!window.confirm('Delete this review?')) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/reviews/${id}`, { headers });
      setNotice({ type: 'success', text: 'Review deleted successfully.' });
      await load();
    } catch (e) {
      console.error('delete review error:', e);
      setNotice({
        type: 'error',
        text: e.response?.data?.error || 'Failed to delete review.',
      });
    }
  };

  return (
    <div className="reviews-admin-page">
      <div className="reviews-admin-shell">
        <div className="reviews-admin-top">
          <div>
            <h1>Manage Reviews</h1>
            <p>Monitor traveler reviews and remove unwanted content.</p>
          </div>
        </div>

        {notice.text && (
          <div className={`reviews-notice ${notice.type === 'error' ? 'error' : 'success'}`}>
            {notice.text}
          </div>
        )}

        <section className="reviews-stats-grid">
          <div className="reviews-stat-card">
            <span>Total Reviews</span>
            <strong>{stats.totalReviews}</strong>
          </div>
          <div className="reviews-stat-card"><span>5 Stars</span><strong>{stats.ratings?.[5] || 0}</strong></div>
          <div className="reviews-stat-card"><span>4 Stars</span><strong>{stats.ratings?.[4] || 0}</strong></div>
          <div className="reviews-stat-card"><span>3 Stars</span><strong>{stats.ratings?.[3] || 0}</strong></div>
          <div className="reviews-stat-card"><span>2 Stars</span><strong>{stats.ratings?.[2] || 0}</strong></div>
          <div className="reviews-stat-card"><span>1 Star</span><strong>{stats.ratings?.[1] || 0}</strong></div>
        </section>

        <section className="reviews-panel">
          <div className="reviews-panel-head">
            <h2>Review List</h2>
            <input
              className="reviews-search"
              placeholder="Search by name, email, or comment..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {loading ? (
            <p className="reviews-muted">Loading...</p>
          ) : (
            <div className="reviews-list">
              {filtered.map((review) => (
                <div className="review-admin-card" key={review._id}>
                  <div className="review-admin-card-head">
                    <div>
                      <div className="review-admin-rating">
                        {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                      </div>
                      <h3>{review.name}</h3>
                      <p className="review-admin-meta">
                        {review.user?.email || 'Guest review'} • {new Date(review.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <button className="review-delete-btn" onClick={() => remove(review._id)}>
                      Delete
                    </button>
                  </div>

                  <p className="review-admin-comment">{review.comment}</p>
                </div>
              ))}

              {filtered.length === 0 && (
                <div className="reviews-empty">No reviews found.</div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}