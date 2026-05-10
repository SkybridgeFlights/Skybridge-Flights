import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../apiConfig';
import { withTrackerLanguage } from '../utils/trackerLanguage';
import './BlogPage.css';

const languages = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'de', label: 'Deutsch' },
];

function articlePath(post) {
  return post.language && post.language !== 'en'
    ? `/blog/${post.language}/${post.slug}`
    : `/blog/${post.slug}?lang=${post.language || 'en'}`;
}

function BlogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const language = useMemo(() => searchParams.get('lang') || 'en', [searchParams]);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await axios.get(
          `${API_BASE_URL}/api/blog?language=${encodeURIComponent(language)}`
        );
        setPosts(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error('Failed to fetch blog posts:', err);
        setError('Failed to load blog posts.');
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [language]);

  useEffect(() => {
    document.title = 'Travel Blog | Skybridge Flights';
    const description = 'Skybridge Flights travel articles about flights, airports, baggage, visas, hotels, car rental, and destination planning.';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', description);
  }, []);

  const formatDate = (value) => {
    if (!value) return '';
    try {
      return new Date(value).toLocaleDateString(language === 'ar' ? 'ar' : language === 'de' ? 'de-DE' : 'en', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return value;
    }
  };

  return (
    <div className="blog-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="blog-page-header">
        <h1>Skybridge Travel Blog</h1>
        <p>Practical travel guides for flights, airports, baggage, hotels, car rental, visas, and destination planning.</p>
        <div className="blog-tracker-links">
          <Link to={withTrackerLanguage('/flight-tracker', language)}>Open Flight Tracker</Link>
          <Link to={withTrackerLanguage('/airports/BER', language)}>Berlin Airport Intelligence</Link>
        </div>

        <div className="blog-language-switch" aria-label="Blog language">
          {languages.map((item) => (
            <button
              type="button"
              key={item.code}
              className={language === item.code ? 'active' : ''}
              onClick={() => setSearchParams({ lang: item.code })}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="blog-state">Loading blog posts...</p>
      ) : error ? (
        <p className="blog-state error">{error}</p>
      ) : posts.length === 0 ? (
        <p className="blog-state">No published articles are available for this language yet.</p>
      ) : (
        <div className="blog-grid">
          {posts.map((post) => (
            <article className="blog-card" key={post._id}>
              {post.coverImage || post.featuredImage ? (
                <Link to={articlePath(post)} className="blog-card-image-link">
                  <img
                    src={post.featuredImage || post.coverImage}
                    alt={post.imageAltText || post.title}
                    className="blog-card-image"
                  />
                </Link>
              ) : null}

              <div className="blog-card-body">
                <div className="blog-card-meta">
                  <span>{formatDate(post.publishedAt || post.createdAt)}</span>
                  <span>{post.readingTime || 1} min read</span>
                  <span>{String(post.category || 'travel').replace(/-/g, ' ')}</span>
                </div>

                <h2 className="blog-card-title">
                  <Link to={articlePath(post)}>{post.title}</Link>
                </h2>

                {post.excerpt ? <p className="blog-card-excerpt">{post.excerpt}</p> : null}

                {Array.isArray(post.tags) && post.tags.length > 0 ? (
                  <div className="blog-card-tags">
                    {post.tags.slice(0, 4).map((tag, index) => (
                      <span className="blog-tag" key={`${post._id}-${index}`}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                <Link to={articlePath(post)} className="blog-read-more">
                  Read article
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default BlogPage;
