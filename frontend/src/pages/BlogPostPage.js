import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useLocation, useParams } from 'react-router-dom';
import { API_BASE_URL } from '../apiConfig';
import './BlogPostPage.css';

function articlePath(item) {
  return item.language && item.language !== 'en'
    ? `/blog/${item.language}/${item.slug}`
    : `/blog/${item.slug}?lang=${item.language || 'en'}`;
}

function renderMarkdown(content) {
  return String(content || '')
    .split('\n')
    .filter((line) => line.trim())
    .map((line, index) => {
      if (line.startsWith('# ')) return <h2 key={index}>{line.replace(/^#\s+/, '')}</h2>;
      if (line.startsWith('## ')) return <h3 key={index}>{line.replace(/^##\s+/, '')}</h3>;
      if (line.startsWith('- ')) return <li key={index}>{line.replace(/^-\s+/, '')}</li>;
      return <p key={index}>{line}</p>;
    });
}

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

function BlogPostPage() {
  const { slug, lang } = useParams();
  const location = useLocation();
  const [post, setPost] = useState(null);
  const [translations, setTranslations] = useState([]);
  const [hreflang, setHreflang] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const startRef = useRef(Date.now());
  const trackedRef = useRef(false);

  const language = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return lang || params.get('lang') || 'en';
  }, [location.search, lang]);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true);
        setError('');
        trackedRef.current = false;
        startRef.current = Date.now();

        const endpoint = lang
          ? `${API_BASE_URL}/api/blog/${encodeURIComponent(lang)}/${encodeURIComponent(slug)}`
          : `${API_BASE_URL}/api/blog/${encodeURIComponent(slug)}?language=${encodeURIComponent(language)}`;
        const response = await axios.get(endpoint);

        setPost(response.data?.post || null);
        setTranslations(Array.isArray(response.data?.translations) ? response.data.translations : []);
        setHreflang(Array.isArray(response.data?.hreflang) ? response.data.hreflang : []);
      } catch (err) {
        console.error('Failed to fetch blog post:', err);
        setError('Failed to load blog post.');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [slug, language, lang]);

  useEffect(() => {
    if (!post) return;
    const metaTitle = post.metaTitle || post.seoTitle || post.title;
    const metaDescription = post.metaDescription || post.seoDescription || post.excerpt;
    document.title = metaTitle;
    setMeta('description', metaDescription);
    setMeta('og:title', metaTitle, 'property');
    setMeta('og:description', metaDescription, 'property');
    setMeta('og:type', 'article', 'property');
    setMeta('twitter:card', 'summary_large_image');
    if (post.featuredImage || post.coverImage) {
      setMeta('og:image', post.featuredImage || post.coverImage, 'property');
    }

    document.querySelectorAll('link[data-blog-hreflang="true"]').forEach((item) => item.remove());
    hreflang.forEach((item) => {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = item.language;
      link.href = item.url;
      link.setAttribute('data-blog-hreflang', 'true');
      document.head.appendChild(link);
    });
    if (post.canonicalUrl) {
      let canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = post.canonicalUrl;
    }
  }, [post, hreflang]);

  useEffect(() => {
    if (!post || trackedRef.current) return;
    trackedRef.current = true;
    axios
      .post(`${API_BASE_URL}/api/blog/${post._id}/view`, {
        visitorId: localStorage.getItem('blogVisitorId') || (() => {
          const id = Math.random().toString(36).slice(2);
          localStorage.setItem('blogVisitorId', id);
          return id;
        })(),
        referrer: document.referrer || 'direct',
      })
      .catch(() => {});
  }, [post]);

  useEffect(() => {
    return () => {
      if (!post) return;
      const readTimeSeconds = Math.round((Date.now() - startRef.current) / 1000);
      axios.post(`${API_BASE_URL}/api/blog/${post._id}/view`, { readTimeSeconds }).catch(() => {});
    };
  }, [post]);

  const handleCtaClick = () => {
    if (!post) return;
    axios.post(`${API_BASE_URL}/api/blog/${post._id}/cta-click`, { type: post.cta?.type || 'search' }).catch(() => {});
  };

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

  if (loading) {
    return <div className="blog-post-page"><p className="blog-post-state">Loading article...</p></div>;
  }

  if (error || !post) {
    return (
      <div className="blog-post-page">
        <p className="blog-post-state error">{error || 'Article not found.'}</p>
      </div>
    );
  }

  return (
    <div className="blog-post-page" dir={post.language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="blog-post-container">
        <div className="blog-post-topbar">
          <Link to={`/blog?lang=${post.language}`} className="blog-back-link">
            Back to blog
          </Link>

          {translations.length > 0 ? (
            <div className="blog-post-languages">
              {translations.map((item) => (
                <Link key={`${item.slug}-${item.language}`} to={articlePath(item)} className={item.language === post.language ? 'active' : ''}>
                  {item.language.toUpperCase()}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        {post.coverImage || post.featuredImage ? (
          <img src={post.featuredImage || post.coverImage} alt={post.imageAltText || post.title} className="blog-post-cover" />
        ) : null}

        <article className="blog-post-article">
          <div className="blog-post-meta">
            <span>{formatDate(post.publishedAt || post.createdAt)}</span>
            {post.lastReviewedAt ? <span>Reviewed {formatDate(post.lastReviewedAt)}</span> : null}
            <span>{post.readingTime || 1} min read</span>
            <span>{String(post.category || 'travel').replace(/-/g, ' ')}</span>
            <span>{post.language.toUpperCase()}</span>
          </div>

          <h1 className="blog-post-title">{post.title}</h1>
          <div className="blog-author-box">
            <strong>{post.authorProfile?.name || post.author || 'Skybridge AI Travel Editor'}</strong>
            <span>{post.authorProfile?.role || 'Travel content editor'}</span>
            {post.sourceNotes ? <p>{post.sourceNotes}</p> : null}
          </div>
          {post.excerpt ? <p className="blog-post-excerpt">{post.excerpt}</p> : null}

          <div className="blog-post-content">{renderMarkdown(post.content)}</div>

          {Array.isArray(post.faq) && post.faq.length > 0 ? (
            <section className="blog-post-faq">
              <h2>FAQ</h2>
              {post.faq.map((item, index) => (
                <details key={index}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </section>
          ) : null}

          <div className="blog-post-cta">
            <div>
              <strong>Plan your next trip with Skybridge Flights</strong>
              <p>Compare flights and continue to booking, support, or contact options when you are ready.</p>
            </div>
            <Link to={post.cta?.url || '/flights'} onClick={handleCtaClick}>
              {post.cta?.label || 'Search flights'}
            </Link>
          </div>

          {Array.isArray(post.internalLinks) && post.internalLinks.length > 0 ? (
            <div className="blog-post-links">
              {post.internalLinks.map((item, index) => (
                <Link key={`${item.url}-${index}`} to={item.url}>{item.label}</Link>
              ))}
            </div>
          ) : null}

          {Array.isArray(post.tags) && post.tags.length > 0 ? (
            <div className="blog-post-tags">
              {post.tags.map((tag, index) => (
                <span className="blog-post-tag" key={`${tag}-${index}`}>#{tag}</span>
              ))}
            </div>
          ) : null}

          <div className="blog-editorial-note">
            <strong>Editorial policy</strong>
            <p>{post.editorialPolicy || 'Skybridge Flights publishes evergreen travel planning content with review and SEO quality checks.'}</p>
            <p>{post.travelDisclaimer}</p>
          </div>
        </article>

        {post.schemaMarkup ? (
          <script type="application/ld+json">
            {JSON.stringify(post.schemaMarkup)}
          </script>
        ) : null}
      </div>
    </div>
  );
}

export default BlogPostPage;
