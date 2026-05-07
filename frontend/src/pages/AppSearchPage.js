import React, { useEffect } from 'react';

const AppSearchPage = () => {
  useEffect(() => {
    const oldScript = document.getElementById('tpwl-widget-script');

    if (!oldScript) {
      const script = document.createElement('script');
      script.id = 'tpwl-widget-script';
      script.async = true;
      script.type = 'module';
      script.src = 'https://tpwdg.com/wl_web/main.js?wl_id=15055';
      document.head.appendChild(script);
    }
  }, []);

  return (
    <div className="app-search-page">
      <section className="app-search-hero">
        <div className="hero-overlay" />
        <div className="app-search-hero-content">
          <span className="app-search-badge">Skybridge Flights</span>
          <h1>Search smarter. Fly better.</h1>
          <p>
            Compare flights, discover competitive fares, and book with confidence
            through one clean experience.
          </p>

          <div className="hero-points">
            <div className="hero-point">Fast search</div>
            <div className="hero-point">Clean results</div>
            <div className="hero-point">Mobile optimized</div>
          </div>
        </div>
      </section>

      <section className="app-search-shell">
        <div className="search-panel">
          <div className="search-panel-top">
            <div>
              <span className="section-kicker">Flight search</span>
              <h2>Plan your next journey</h2>
              <p>
                Enter your route and dates below to view live flight options.
              </p>
            </div>

            <div className="search-status">
              <span className="status-dot" />
              Powered for Skybridge
            </div>
          </div>

          <div className="tpwl-search-box">
            <div id="tpwl-search"></div>
          </div>
        </div>

        <div className="results-panel">
          <div className="results-panel-top">
            <div>
              <span className="section-kicker">Results</span>
              <h3>Available flight options</h3>
            </div>
          </div>

          <div id="tpwl-tickets" className="tpwl-results-box"></div>
        </div>
      </section>

      <style>{`
        .app-search-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(77,108,255,0.10), transparent 18%),
            linear-gradient(180deg, #f7f9fd 0%, #edf3ff 100%);
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #0f172a;
        }

        .app-search-hero {
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, #223fc7 0%, #3f63f6 55%, #2747d9 100%);
          padding: 54px 20px 120px;
        }

        .hero-overlay {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 85% 20%, rgba(255,255,255,0.16), transparent 16%),
            radial-gradient(circle at 92% 8%, rgba(255,255,255,0.10), transparent 10%);
          pointer-events: none;
        }

        .app-search-hero-content {
          position: relative;
          z-index: 1;
          max-width: 1160px;
          margin: 0 auto;
          color: #fff;
        }

        .app-search-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.16);
          border: 1px solid rgba(255,255,255,0.20);
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 16px;
          backdrop-filter: blur(6px);
        }

        .app-search-hero h1 {
          margin: 0 0 12px;
          max-width: 760px;
          font-size: clamp(32px, 5vw, 58px);
          line-height: 1.02;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .app-search-hero p {
          margin: 0;
          max-width: 720px;
          font-size: 17px;
          line-height: 1.8;
          color: rgba(255,255,255,0.92);
        }

        .hero-points {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 22px;
        }

        .hero-point {
          padding: 10px 14px;
          border-radius: 14px;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.18);
          font-size: 14px;
          font-weight: 600;
        }

        .app-search-shell {
          position: relative;
          z-index: 2;
          max-width: 1160px;
          margin: -74px auto 0;
          padding: 0 20px 48px;
        }

        .search-panel,
        .results-panel {
          background: rgba(255,255,255,0.92);
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.10);
          backdrop-filter: blur(10px);
        }

        .search-panel {
          padding: 24px;
          margin-bottom: 22px;
        }

        .results-panel {
          padding: 24px;
        }

        .search-panel-top,
        .results-panel-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }

        .section-kicker {
          display: inline-block;
          margin-bottom: 8px;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #5b76e8;
        }

        .search-panel-top h2,
        .results-panel-top h3 {
          margin: 0 0 8px;
          color: #0f172a;
          font-size: 30px;
          line-height: 1.15;
          font-weight: 800;
        }

        .search-panel-top p {
          margin: 0;
          color: #64748b;
          font-size: 15px;
          line-height: 1.7;
        }

        .search-status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 999px;
          background: #eef4ff;
          color: #2f49d1;
          font-size: 13px;
          font-weight: 700;
          border: 1px solid #dbe6ff;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #2f49d1;
        }

        .tpwl-search-box {
          background: #f8fbff;
          border: 1px solid #e4ebf7;
          border-radius: 20px;
          padding: 18px;
        }

        .tpwl-results-box {
          min-height: 260px;
        }

        @media (max-width: 768px) {
          .app-search-hero {
            padding: 42px 16px 96px;
          }

          .app-search-shell {
            margin-top: -58px;
            padding: 0 14px 36px;
          }

          .search-panel,
          .results-panel {
            padding: 18px;
            border-radius: 18px;
          }

          .tpwl-search-box {
            padding: 12px;
            border-radius: 16px;
          }

          .app-search-hero h1 {
            font-size: 34px;
          }

          .search-panel-top h2,
          .results-panel-top h3 {
            font-size: 24px;
          }

          .app-search-hero p {
            font-size: 15px;
          }
        }
      `}</style>
    </div>
  );
};

export default AppSearchPage;