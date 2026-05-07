import { useEffect } from "react";
import Head from "next/head";
import Script from "next/script";

export default function AppSearchPage() {
  useEffect(() => {
    const existing = document.getElementById("tpwl-widget-script");

    if (!existing) {
      const script = document.createElement("script");
      script.id = "tpwl-widget-script";
      script.src = "https://tpwdg.com/wl_web/main.js?wl_id=15055";
      script.type = "module";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  return (
    <>
      <Head>
        <title>Skybridge Flights App Search</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <Script
        id="tpwl-inline-config"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.tpwlLoaded = true;
          `,
        }}
      />

      <div className="app-search-page">
        <div className="app-search-shell">
          <div id="tpwl-search"></div>
          <div id="tpwl-tickets"></div>
        </div>
      </div>

      <style jsx>{`
        .app-search-page {
          min-height: 100vh;
          background: #f5f7fb;
          padding: 16px;
        }

        .app-search-shell {
          max-width: 1100px;
          margin: 0 auto;
        }

        #tpwl-search {
          margin-bottom: 20px;
        }

        #tpwl-tickets {
          min-height: 300px;
        }
      `}</style>
    </>
  );
}