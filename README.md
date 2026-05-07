# Skybridge Flights

Skybridge Flights is a full-stack travel platform with public flight search, booking-related pages, admin tools, authentication, reviews, support workflows, and an AI-powered multilingual blog automation system.

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
