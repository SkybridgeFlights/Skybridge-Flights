# Skybridge Flights

Skybridge Flights is a full-stack travel platform with public flight search, booking-related pages, admin tools, authentication, reviews, support workflows, and an AI-powered multilingual blog automation system.
It also includes a Skybridge Flight Tracker with a multi-provider architecture: Flightradar24 as the premium live-data source, OpenSky Network as the always-available fallback, and Aviationstack / FlightAware for commercial schedule enrichment.

## Project Structure

```txt
Backend/     Express, MongoDB/Mongoose, admin APIs, schedulers, AI blog services
frontend/    React app, public pages, admin UI
```

## AI Blog System

The Skybridge AI Blog Auto Publisher supports:

- multilingual blog posts in English, Arabic, and German
- public blog listing and article detail pages
- programmatic SEO landing pages
- public live flight tracker and airport intelligence pages
- AI article generation with SEO, FAQ, CTA, image metadata, and internal links
- trend research and topic scoring
- queue-based generation with retries and daily/monthly budget limits
- semantic duplicate prevention
- SEO QA, broken-link checks, sitemap QA, and content refresh suggestions
- Search Console and Cloudinary integrations when configured
- admin notifications, optional email/WhatsApp alert delivery, version history, rollback, and visual diffs
- Redis distributed scheduler locking with MongoDB fallback

Full operational documentation is in `Backend/docs/AI_BLOG_SYSTEM.md`.

## Environment Setup

Copy `.env.example` and fill only the values required for your deployment. Never commit real `.env` files.

```bash
cp .env.example Backend/.env
```

For Create React App, frontend variables must use the `REACT_APP_` prefix and can be placed in `frontend/.env` for local development.

Important backend variables include:

- `MONGO_URI`
- `JWT_SECRET`
- `SITE_URL`
- `CORS_ORIGINS`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `REDIS_URL`
- `SEARCH_CONSOLE_CLIENT_EMAIL`
- `SEARCH_CONSOLE_PRIVATE_KEY`
- `SEARCH_CONSOLE_SITE_URL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `OPENSKY_CLIENT_ID`
- `OPENSKY_CLIENT_SECRET`
- `AVIATIONSTACK_API_KEY`
- `FLIGHTAWARE_API_KEY`
- `FLIGHT_TRACKER_COMMERCIAL_PROVIDER`
- `FLIGHT_TRACKER_ENABLED`
- `FLIGHT_TRACKER_CACHE_MS`
- `FLIGHT_TRACKER_MAX_AIRCRAFT`
- `FLIGHT_TRACKER_RATE_LIMIT_PER_MINUTE`
- `FLIGHT_TRACKER_DEFAULT_REGION`
- `FLIGHT_TRACKER_ENABLED_REGIONS`
- `FLIGHT_TRACKER_SHOW_CTA`
- `FLIGHTRADAR24_API_KEY`
- `FLIGHT_TRACKER_PRIMARY_PROVIDER`
- `FR24_LIVE_CACHE_MS`
- `FR24_DETAILS_CACHE_MS`
- `FR24_TRACKS_CACHE_MS`
- `FR24_RATE_LIMIT_PER_MINUTE`

## Flight Tracker Provider Setup

### Flightradar24 (premium live data)

Obtain an API key from [fr24api.flightradar24.com](https://fr24api.flightradar24.com) and set:

```
FLIGHTRADAR24_API_KEY=your_key_here
FLIGHT_TRACKER_PRIMARY_PROVIDER=auto
```

`auto` (the default) uses FR24 when a key is present and falls back to OpenSky automatically. Set to `fr24` to force FR24, or `opensky` to always use OpenSky.

**Explorer plan limits** — the service enforces a conservative 8 req/min ceiling by default. Do not poll more aggressively without upgrading your plan. The UI's refresh intervals are already calibrated to stay within this budget.

New endpoints available with FR24:

| Endpoint | Description |
|---|---|
| `GET /api/flight-tracker/flights/:flightId` | Full flight details (registration, schedule, status) |
| `GET /api/flight-tracker/track/:flightId` | Historical track points for map route replay |
| `GET /api/flight-tracker/providers/health` | Live status of all providers (FR24, OpenSky, commercial) |

All existing endpoints (`/live`, `/search`, `/airport/:code`, `/aircraft/:icao24`, `/health`) continue to work regardless of which provider is active.

### OpenSky Network (free fallback)

OpenSky requires no key for anonymous access. For higher rate limits add credentials:

```
OPENSKY_CLIENT_ID=your_client_id
OPENSKY_CLIENT_SECRET=your_client_secret
```

### Commercial enrichment (schedule, ETA, delay)

Set one of:

```
FLIGHT_TRACKER_COMMERCIAL_PROVIDER=aviationstack
AVIATIONSTACK_API_KEY=your_key

# or

FLIGHT_TRACKER_COMMERCIAL_PROVIDER=flightaware
FLIGHTAWARE_API_KEY=your_key
```

Leave `FLIGHT_TRACKER_COMMERCIAL_PROVIDER` unset (or `none`) to disable commercial enrichment — the tracker still works with live position data only.

All placeholders are intentionally empty in `.env.example`.

## Install

```bash
cd Backend
npm install

cd ../frontend
npm install
```

## Development Commands

Backend:

```bash
cd Backend
npm run dev
```

Frontend:

```bash
cd frontend
npm start
```

Production frontend build:

```bash
cd frontend
npm run build
```

Tests:

```bash
node Backend/tests/blogPhase6Smoke.js
node Backend/tests/flightTrackerSmoke.js

cd frontend
CI=true npm test -- --watchAll=false
```

## Roles and Permissions

The backend is the source of truth for authorization.

- Admin: settings, production tests, manual QA, rollback, delete, publish.
- `manageBlog`: create/edit drafts, assets, QA reports, analytics, notifications.
- `publishBlog`: publish/unpublish blog posts and SEO landing pages.

The admin UI hides controls where possible, but protected API routes must remain enforced.

## Scheduler and QA

The blog scheduler supports:

- scheduled post publishing
- daily AI generation
- scheduled SEO QA
- broken-link checks
- sitemap QA
- Search Console sync
- refresh candidate scans

Safe defaults:

- auto-publish mode should remain `draft-only` until QA is verified
- scheduled QA is disabled until enabled by an admin
- missing provider credentials must not crash the backend

Set `REDIS_URL` in multi-instance deployments to prevent duplicate scheduled jobs. Without Redis, MongoDB lock fallback is used.

## Deployment Notes

- Do not deploy `.env` files to GitHub.
- Do not commit `node_modules`, `frontend/build`, logs, uploads, cache, or temporary files.
- Set `SITE_URL` to the public production URL for canonical URLs and sitemap output.
- Configure CORS with production origins.
- Rotate any credential that was ever committed or exposed.
- Run backend smoke checks, frontend build, and frontend tests before deploying.

## Recommended Branching

- `main`: production-ready releases
- `develop`: integration branch
- `feature/*`: isolated feature work
