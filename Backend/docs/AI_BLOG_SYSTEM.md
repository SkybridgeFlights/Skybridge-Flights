# Skybridge AI Blog Auto Publisher

## Overview

The AI blog system generates multilingual travel articles, scores SEO/quality, prevents duplicate content, queues background jobs, tracks AI usage, and exposes admin controls under `/admin/blog`.

Core flow:

1. Admin or scheduler queues an AI article job.
2. The Mongo fallback queue runs jobs with retries and concurrency limits.
3. The research layer collects trend/suggestion signals or falls back to evergreen travel keywords.
4. The generator creates article content, FAQ, keywords, image prompt, and CTA.
5. Duplicate checks, SEO checks, budget checks, FAQ/CTA/internal-link checks, and quality checks run before publishing.
6. Passed articles publish only when auto-publish is enabled. Failed articles stay as drafts with guardrail reasons.

## Environment Variables

Required base variables:

```env
OPENAI_API_KEY=
AI_PROVIDER=openai
OPENAI_MODEL=gpt-4.1-mini
SITE_URL=https://skybridgeflights.com
BLOG_AUTO_PUBLISH_ENABLED=false
BLOG_CRON_TIME=09:00
BLOG_TIMEZONE=Europe/Berlin
```

Phase 2 optional variables:

```env
REDIS_URL=
SEARCH_CONSOLE_CLIENT_EMAIL=
SEARCH_CONSOLE_PRIVATE_KEY=
SEARCH_CONSOLE_SITE_URL=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
AI_IMAGE_PROVIDER=prompt-only
AI_IMAGE_MODEL=
AI_DAILY_BUDGET_LIMIT=10
AI_MONTHLY_BUDGET_LIMIT=200
GOOGLE_TRENDS_API_KEY=
TREND_PROVIDER_KEY=
TREND_PROVIDER_URL=
PAA_PROVIDER_URL=
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

If `OPENAI_API_KEY` is missing, the system uses an evergreen fallback article generator. If Search Console or Cloudinary credentials are missing, those integrations report as not configured and do not crash the app.

## Queue Setup

The current implementation uses a safe Mongo-backed fallback queue because BullMQ/Redis is not installed in this project. Jobs are stored in `BlogJob` with status, attempts, logs, result, and errors.

Controls:

- `maxConcurrentAiJobs`
- `maxJobRetries`
- duplicate daily job keys for scheduled auto-publish
- admin recent job view

`REDIS_URL` is reserved for a future BullMQ worker if Redis is added.

## Cost Monitoring

Usage is stored in `BlogUsage` by day and month. The system estimates tokens and cost before generation.

Controls:

- daily generation limit
- monthly generation limit
- daily token limit
- daily cost limit
- monthly cost limit
- max retries

Generation stops before calling AI when limits are exceeded.

## Search Console

Search Console credentials are optional. The Phase 2 adapter exposes a safe summary endpoint and weak-page detection from stored Search Console fields. A full Google API pull can be added once the project includes the Google auth client dependency.

## Manual Testing

1. Start backend and frontend.
2. Login as admin.
3. Open `/admin/blog`.
4. Click `Run Trend Research`.
5. Click `Queue Generation`.
6. Watch the Queue & Cost Protection card.
7. Review generated drafts and guardrail reasons.
8. Publish only articles that pass duplicate, SEO, quality, FAQ, CTA, and internal-link checks.
9. Open `/blog?lang=en` and an article detail page.
10. Check `/sitemap.xml` includes published blog posts and published programmatic SEO pages.

## Disable Auto Publishing

Set:

```env
BLOG_AUTO_PUBLISH_ENABLED=false
```

Or turn off `Auto publishing` in the admin settings panel.

## Programmatic SEO Foundation

Admin can create route/service landing-page records such as:

- `/flights/from-germany-to-turkey`
- `/flights/from-dresden-to-dubai`
- `/flights/from-berlin-to-beirut`
- `/travel-guides/:destination`

Phase 2 creates model/API/admin/sitemap support. Public rendering of these pages can be added in Phase 3.

## Phase 3 Features

Phase 3 adds public programmatic SEO page rendering, optional live Search Console sync, Cloudinary/image-provider wiring, body-level internal link insertion, richer analytics cards, and content refresh suggestions.

Public routes:

```txt
/flights/:slug
/travel-guides/:slug
/seo/:slug
```

The existing `/flights` flight search route remains unchanged. Only nested slug routes use the programmatic SEO renderer.

## Programmatic SEO Route Setup

Create pages from `/admin/blog` in the Programmatic SEO Foundation section. Published pages are loaded by path from:

```txt
GET /api/blog/seo-pages/public/:slug?path=/flights/from-berlin-to-beirut
```

Sitemap inclusion is automatic for published SEO landing pages.

## Search Console Setup

Create a Google service account with Search Console read access, add the service account email as a restricted user in Search Console, then configure:

```env
SEARCH_CONSOLE_CLIENT_EMAIL=
SEARCH_CONSOLE_PRIVATE_KEY=
SEARCH_CONSOLE_SITE_URL=sc-domain:skybridgeflights.com
```

Use `/admin/blog` -> `Sync Search Console`. If credentials fail, the sync returns an error object and the backend keeps running.

## Cloudinary Setup

Configure:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

When configured, generated or existing featured images can be uploaded through Cloudinary with WebP/quality transformations. Without Cloudinary, the system stores image prompts and uses the fallback image.

## Image Provider Setup

Prompt-only mode:

```env
AI_IMAGE_PROVIDER=prompt-only
```

OpenAI image generation mode:

```env
AI_IMAGE_PROVIDER=openai
AI_IMAGE_MODEL=gpt-image-1
OPENAI_API_KEY=
```

If image generation or upload fails, the article still saves with fallback image metadata.

## Analytics Usage

The admin blog dashboard shows:

- views over time
- top posts
- top languages
- top referrers
- CTA clicks
- conversion rate
- Search Console clicks/impressions/CTR
- weak pages needing SEO updates

Analytics are intentionally aggregate-only and do not expose private user data.

## Internal Link Insertion

The system now inserts Markdown links into generated article bodies when natural anchor phrases are found. It stores an `insertedLinksReport` showing inserted and skipped links. Controls:

- `maxInternalLinksPerArticle`
- `requireInternalLinks`

The inserter avoids duplicate URLs and repeated anchors.

## Content Refresh Workflow

Refresh candidates are posts that are old, weak by CTR/read time, or not recently reviewed.

Workflow:

1. Open `/admin/blog`.
2. Review Content Refresh Candidates.
3. Click `Suggest`.
4. The system stores SEO/version suggestions without overwriting published content.
5. Admin can later apply changes manually.

Controls:

```txt
contentRefreshAfterDays
autoApplyCtrOptimizations
```

Default behavior is suggestion/draft mode, not automatic overwrite.

## Troubleshooting

- Search Console sync says credentials missing: verify all three Search Console env vars.
- Search Console sync returns auth error: ensure the service account email has Search Console property access and private key newlines are preserved.
- Images stay as fallback: verify Cloudinary env vars and `AI_IMAGE_PROVIDER`.
- Programmatic SEO page 404s: ensure the page status is `published` and its `path` matches the browser URL.
- Article will not publish: inspect `guardrailReasons` for SEO score, quality score, duplicate similarity, canonical URL, internal link, FAQ, or CTA failures.

## Phase 4 Features

Phase 4 adds production QA and safer publishing controls:

- SEO QA dashboard for blog posts and programmatic SEO pages.
- Broken-link checker for published article bodies, internal links, SEO page sections, and CTAs.
- Sitemap QA report for published blog and SEO landing URLs.
- Basic image asset library for external, generated, prompt-only, and Cloudinary-backed assets.
- Version history before article/page updates and publish actions.
- Rollback endpoint for stored versions.
- Stricter auto-publish settings with `off`, `draft-only`, and `publish-if-safe` modes.
- Lightweight performance SEO warnings for image dimensions, non-WebP images, title/description length, content length, excessive links, and missing headings.

## SEO QA Workflow

1. Open `/admin/blog`.
2. Review the SEO QA Dashboard.
3. Filter by issue type.
4. Use `Fix` for safe automated fixes such as missing meta title, missing description, canonical URL, image alt, FAQ, or CTA.
5. Re-run SEO regeneration if needed.
6. Publish only after validation warnings are resolved.

## Broken Link Checker

The broken-link checker never runs during server startup. It only runs manually from the admin dashboard:

```txt
POST /api/blog/admin/broken-links/run
```

It checks internal routes that can be verified locally:

- `/blog/...`
- `/flights/...`
- `/travel-guides/...`
- `/seo/...`
- known static routes such as `/flights`, `/blog`, `/contact`, `/about`

External links are marked as `suspect`, not broken.

## Editor Usage

Blog articles can be edited from `/admin/blog` using the article form:

- title, slug, excerpt
- body content
- FAQ
- SEO metadata
- featured image URL and alt
- tags, category, language, status

SEO landing pages can be opened in the Programmatic SEO section and edited in the preview editor:

- title, slug, language, status
- meta title and description
- canonical URL
- sections
- CTA label and URL
- source notes

## Asset Library Usage

Use the Asset Library card in `/admin/blog` to add image metadata without requiring Cloudinary:

- image URL
- title
- alt text
- provider

Selecting an asset fills the current article editor image URL and alt text.

## Safer Auto-Publish Settings

Recommended production default:

```txt
autoPublishMode=draft-only
requireValidSchema=true
requireImageAlt=true
requireFaq=true
requireCta=true
requireInternalLinks=true
requireNoBrokenInternalLinks=true
requireNoDuplicateSimilarityWarning=true
```

Only use `publish-if-safe` after QA reports and broken-link reports are clean.

## Rollback Process

Versions are stored before major updates and publish actions. In `/admin/blog`, click `Versions` on an article, review the stored actions and dates, then use `Rollback`.

Rollback creates a safety version of the current content before restoring the selected snapshot.

## Production Checklist

- Keep `autoPublishMode=draft-only` until live QA is verified.
- Run SEO QA after imports, generation, and manual edits.
- Run broken-link checks before publishing batches.
- Check sitemap QA after publishing SEO landing pages.
- Confirm Search Console credentials and sync status.
- Confirm image alt text and image dimensions for every published item.
- Review version history before rolling back.

## Phase 5 Features

Phase 5 adds production readiness tools around the existing blog automation system:

- Scheduled QA runner for SEO QA, broken links, sitemap QA, refresh candidates, and Search Console sync.
- Admin notifications for failed generation, failed publishing, low SEO scores, broken links, sitemap issues, budget limits, Search Console failures, old content, and duplicate warnings.
- Blog system health dashboard with scheduler, queue, provider, sitemap, content, and usage status.
- Production test tools for AI generation, trend research, Search Console, image pipeline, sitemap, broken-link checker, and public routes.
- Visual version diff for blog posts and SEO landing pages.
- Permission-aware backend controls for settings, publishing, rollback, and draft editing.
- Safer deployment defaults that avoid auto-publishing unless explicitly enabled.

## Scheduled QA Setup

Scheduled QA is disabled by default. Enable it only after the blog system has been configured and the first manual QA run is clean.

Settings are stored in the singleton `BlogSettings` record:

```txt
scheduledQaEnabled=false
qaScheduleTime=08:00
qaFrequency=daily
notifyAdminOnIssues=true
```

The scheduler checks the configured time in `BLOG_TIMEZONE` or `BlogSettings.timezone`. Supported frequencies are:

- `daily`
- `weekly`

Manual QA can be run from `/admin/blog` or through:

```txt
POST /api/blog/admin/qa/run
```

The QA runner does not block server startup. Provider errors are converted into status objects and notifications where possible.

## Notification Workflow

Notifications are stored in `BlogNotification` and surfaced in the AI Blog admin dashboard. Each notification has:

- type
- severity
- title
- message
- read/unread state
- optional target record
- metadata for reports or provider responses

Admin API:

```txt
GET /api/blog/admin/notifications
PATCH /api/blog/admin/notifications/:id/read
```

Use the dashboard severity filter to review high-risk items first. Mark notifications as read after the underlying issue has been fixed or accepted.

## Permission Model

The backend follows the existing auth middleware and role permission style:

- `adminOnly`: can change AI blog settings, run production tests, run scheduled QA manually, delete records, and rollback versions.
- `publishBlog`: can publish and unpublish blog posts.
- `manageBlog`: can list, create, and edit blog drafts, SEO landing pages, assets, analytics, QA reports, and notifications.

Frontend controls are convenience controls only. Backend routes remain the source of truth for permissions.

## Production Test Tools

Run production tests from `/admin/blog` with `Run Production Tests` or call:

```txt
POST /api/blog/admin/tests/run
```

Current tests cover:

- trend research
- Search Console sync if credentials exist
- image pipeline fallback/provider behavior
- sitemap availability or local generation
- broken-link checker
- AI article test draft generation
- public blog route availability
- public SEO landing page route availability

The AI generation test creates a draft only; it never publishes automatically.

## Health Dashboard

The health dashboard reads:

```txt
GET /api/blog/admin/health
```

It reports:

- scheduler status and last QA run
- queue status and recent jobs
- last AI generation job
- last successful publish
- Search Console configured/sync state
- Cloudinary/image configuration state
- sitemap status
- published and draft post totals
- SEO landing page total
- monthly AI usage estimate

Use this dashboard after deploys and before enabling automation.

## Deployment Checklist

Before production use:

- Set `SITE_URL` to the real public origin.
- Keep `autoPublishMode=draft-only` unless the team has approved automatic publishing.
- Leave `scheduledQaEnabled=false` until a manual QA pass is clean.
- Confirm `OPENAI_API_KEY` or the selected provider key is present only in server env.
- Confirm `AI_DAILY_BUDGET_LIMIT` and `AI_MONTHLY_BUDGET_LIMIT`.
- Confirm `REDIS_URL` only if BullMQ/Redis should be used; otherwise fallback queue mode is expected.
- Confirm Search Console credentials only if sync is needed.
- Confirm Cloudinary credentials only if uploads are needed.
- Run production tests from the admin dashboard.
- Run SEO QA, broken-link check, and sitemap QA.
- Review unread notifications.

## Rollback Emergency Workflow

1. Open `/admin/blog`.
2. Find the affected blog post or SEO landing page.
3. Open `Versions`.
4. Use `Diff` to compare the stored version with the current record.
5. Roll back only as an admin.
6. Re-run SEO QA and sitemap QA after rollback.
7. Clear related notifications after verification.

## Phase 5 Troubleshooting

- Scheduled QA does not run: verify `scheduledQaEnabled`, `qaScheduleTime`, `qaFrequency`, and the backend scheduler process is active.
- Notifications are missing: verify `notifyAdminOnIssues` and inspect backend logs for database write errors.
- Staff cannot publish: assign the existing `publishBlog` permission or use an admin account.
- Production tests fail on providers: verify provider env vars; missing providers should report skipped/fallback status instead of crashing.
- Search Console fails: confirm service account access to the configured property and private key newline formatting.

## Phase 6 Features

Phase 6 adds final production hardening around delivery, scheduling, permissions, tests, and observability:

- Optional email and WhatsApp delivery for critical in-app notifications.
- Alert templates for failures, broken links, budget limits, publish blocks, Search Console failures, and QA summaries.
- Distributed scheduler locking with Redis when available and MongoDB fallback.
- Locking for daily AI generation, scheduled QA, manual QA, scheduled publish checks, and Search Console sync.
- Permission-aware admin UI controls for settings, publishing, rollback, editing, and production tests.
- Word-level visual diff highlighting in version history.
- Lightweight Phase 6 smoke tests for route registration, permission middleware, and alert delivery rules.
- Structured JSON logging for blog jobs, scheduler locks, notification delivery, Search Console sync, image pipeline status, and guardrail publish blocks.

## Notification Delivery Setup

Notifications remain in-app by default. External delivery is optional and controlled by `BlogSettings`:

```txt
emailNotificationsEnabled=false
whatsappNotificationsEnabled=false
notificationRecipients=[]
whatsappNotificationRecipients=[]
notificationSeverityThreshold=error
notificationQuietHours.enabled=false
notificationQuietHours.start=22:00
notificationQuietHours.end=07:00
```

Email delivery uses the existing `Backend/utils/sendEmail.js` utility. Configure the existing mail env vars:

```txt
RESEND_API_KEY
EMAIL_FROM
```

WhatsApp delivery uses an optional webhook. If no webhook is configured, WhatsApp delivery is skipped safely:

```txt
BLOG_WHATSAPP_WEBHOOK_URL
```

The webhook receives:

```json
{
  "recipients": ["+49123456789"],
  "text": "alert text",
  "notificationType": "publish_blocked",
  "severity": "warning"
}
```

Quiet hours suppress non-error delivery. Error alerts can still be delivered during quiet hours.

## Alert Templates

Alert templates include:

- issue type
- severity
- affected article/page
- admin URL
- recommended action

Template coverage:

- critical blog failure
- broken links report
- budget exceeded
- publish blocked
- Search Console failure
- scheduled QA summary

Templates are generated in `blogAlertTemplateService`.

## Redis Locking Setup

Set `REDIS_URL` to enable Redis locks:

```txt
REDIS_URL=redis://localhost:6379
```

If the `redis` package or Redis server is unavailable, the system falls back to MongoDB locks in `BlogSchedulerLock`. Missing Redis never blocks startup.

Lock behavior:

- lock acquire is logged
- duplicate lock attempts are skipped
- locks have TTLs
- release is best-effort and safe
- stale Mongo locks expire by timestamp

## Troubleshooting Duplicate Scheduler Jobs

If duplicate jobs appear:

1. Confirm all backend instances share the same MongoDB.
2. Configure `REDIS_URL` for stronger multi-instance locking.
3. Check structured logs for `scheduler.lock_acquired`, `scheduler.lock_skipped`, and `scheduler.lock_released`.
4. Confirm system clocks are reasonably synchronized across instances.
5. Verify daily AI generation job keys are unique per date.

## E2E and Integration Tests

The project does not currently include Playwright or Cypress. Phase 6 adds a lightweight Node smoke test:

```txt
node Backend/tests/blogPhase6Smoke.js
```

It checks:

- public blog detail route registration
- public SEO landing page route registration
- admin production test route registration
- publish/settings permission denial
- publish permission approval
- alert template content
- notification severity threshold behavior

Frontend build and the existing React test should still be run:

```txt
cd frontend
npm run build
CI=true npm test -- --watchAll=false
```

## Permission Model

Backend enforcement remains authoritative:

- Admin only: settings, production tests, manual QA run, rollback, delete.
- `publishBlog` or admin: publish/unpublish blog posts and SEO landing pages.
- `manageBlog` or admin: create/edit drafts, assets, reports, analytics, notifications.

The admin UI hides or disables controls based on `localStorage.user.role` and `localStorage.user.permissions`, but backend routes must remain protected.

## Production Observability

Blog system logs are structured JSON with `scope: "ai-blog"`.

Important events:

- `job.started`
- `job.completed`
- `job.failed`
- `notification.created`
- `notification.delivery_completed`
- `notification.delivery_failed`
- `scheduler.lock_acquired`
- `scheduler.lock_released`
- `scheduler.lock_skipped`
- `search_console.sync_completed`
- `search_console.sync_failed`
- `image.pipeline_completed`
- `image.pipeline_fallback`
- `publish.guardrail_blocked`

Sensitive keys, tokens, secrets, passwords, and credentials are redacted before logging.

## Phase 6 Production Checklist

- Keep auto-publish in `draft-only` until QA and alert delivery are verified.
- Configure `RESEND_API_KEY` and `EMAIL_FROM` only if email alerts are needed.
- Configure `BLOG_WHATSAPP_WEBHOOK_URL` only if a trusted WhatsApp delivery webhook exists.
- Set alert recipients and severity threshold in `/admin/blog`.
- Configure `REDIS_URL` for multi-instance deployments.
- Run `node Backend/tests/blogPhase6Smoke.js`.
- Run frontend build and tests.
- Review structured logs after the first scheduled QA run.
- Verify staff permissions before giving publish access.
