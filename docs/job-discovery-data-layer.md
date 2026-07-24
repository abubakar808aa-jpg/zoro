# Job-discovery data layer

JobMan indexes public employer job boards and links every listing back to the
employer's own application page. **JobMan never submits applications** — imported
jobs always route the applicant out to the official careers URL.

This document covers the normalized model, deduplication, ingestion scheduling,
freshness/lifecycle, and the search layer. For per-provider connector setup
(Greenhouse, Lever, Ashby, SmartRecruiters) see
[`job-board-connectors.md`](./job-board-connectors.md).

## 1. Normalized `jobs` model

Imported jobs live in the same `jobs` collection as user-posted jobs, flagged
with `isImported: true`. Fields relevant to discovery (see
`packages/shared/src/types/index.ts` → `JobListing`):

| Field | Meaning |
|---|---|
| `sourceProvider` | `greenhouse` \| `lever` \| `ashby` \| `smartrecruiters` \| `manual` |
| `sourceJobId` | the provider's own job id |
| `sourceKey` | board token / feed key the job was ingested under |
| `sourceUrl` | the listing page on the source board |
| `applyUrl` | **the employer/ATS application link** — always kept separate from `sourceUrl` |
| `companyId` / `companyName` | normalized company slug + display name |
| `title`, `description`, `location`, `remoteType`, `type` (employment), `department` | normalized job facts |
| `salary` | `{ min, max, period, currency? }` when the provider publishes pay |
| `postedAt` | publish date reported by the provider |
| `firstSeenAt` | when JobMan first ingested the job (never overwritten) |
| `lastSeenAt` | last successful fetch that still contained the job |
| `sourceUpdatedAt` | provider's last-updated timestamp |
| `status` | `open` \| `closed` |
| `missedChecks`, `closedReason`, `closedAt` | lifecycle bookkeeping |
| `fingerprint` | dedupe hash (company \| title \| location \| employment type) |
| `alternateSources`, `sourceCount` | other boards carrying the same role |
| `outboundClicks` | count of "Apply on company site" clicks (no PII) |

Raw provider payloads are **not** stored on the public job document. They go to
`jobRaw/{jobDocId}` which is **server-only/debug-only** — denied to all clients
by the security rules.

## 2. Deduplication

`computeFingerprint()` (in `apps/web/lib/job-ingestion/normalize.ts`) hashes the
**normalized company, title, first-locality, and employment type**. Company
normalization strips legal suffixes (`Acme Inc.` → `acme`); location keeps the
first locality (`Austin, TX, USA` → `austin`); remote roles fingerprint as
`remote`.

When a newly seen job matches an existing open listing's fingerprint, it is
**merged** rather than duplicated: the existing listing wins and keeps its own
official `applyUrl`; the newcomer is recorded in `alternateSources[]` and
`sourceCount` is updated. When several candidates share a fingerprint,
`descriptionSimilarity()` (Jaccard over word shingles) is the tie-breaker.

## 3. Ingestion runs & logs

- `ingestionRuns/{id}` — one document per scheduler pass: sources checked/skipped/
  failed, jobs found/created/updated/closed/merged, and errors.
- `sourceFetchLogs/{id}` — one document per source fetch: provider, `sourceKey`,
  `requestedAt`, `durationMs`, `responseStatus`, per-source counts, and `error`.

Both are **admin-readable only** and written server-side.

### Scheduling & backoff

`/api/ingest/run` (POST, `Authorization: Bearer <INGESTION_SECRET>`) fetches
every **due** source, most-overdue first, capped per run. Cadence is stored per
source as `nextFetchAt`:

- **Priority** sources (`priority: true`): every **2–4h**.
- **Normal** sources: every **6–12h**.
- On failure: exponential backoff (`base × 2^consecutiveFailures`, capped at 24h).

The GitHub Actions workflow `.github/workflows/ingest.yml` calls the endpoint
every 2 hours; sources that aren't due yet are skipped. SmartRecruiters is
**not** auto-scheduled — its feed needs an `X-SmartToken` JobMan never persists,
so it stays a manual server-to-server call.

## 4. Freshness & lifecycle

Each successful fetch refreshes `lastSeenAt` on returned jobs. A job that a
source stops returning has its `missedChecks` incremented; after **3 consecutive
successful fetches** that omit it, it is closed (`status: 'closed'`,
`closedReason: 'source_removed'`). Closed jobs are **excluded from search** but
retained for history and still reachable by id.

Freshness labels (`apps/web/lib/freshness.ts`, shown on cards + detail):

- **New today** — first seen within 24h.
- **Still live** — re-confirmed within the last 3h.
- **Checked Nh ago** — last confirmed 3–24h ago.
- **May be stale** — still open but not re-confirmed in over a day (shown only
  when justified).

## 5. Job cards & detail

Cards and the detail page surface company, title, location/remote type,
published pay, source ("via Greenhouse"), and a freshness label. Imported roles
show a **Save** action and an explicit outbound CTA:

> **Apply on company site ↗** · "You're heading to Acme's official careers page."

Clicking it calls `trackOutboundClick()` (via `sendBeacon`), which increments
`jobs/{id}.outboundClicks` server-side through `/api/track/outbound`. **Only the
outbound click is tracked — no personal data.**

## 6. Search & filtering

`/jobs` loads a window of open jobs (`getOpenJobsForSearch`, newest 200) and
filters **client-side** over the current database: keyword (title/company/skills),
location, remote type, employment type, minimum salary, company, posted date,
source, and category. This is deliberate (spec §6): move to Postgres +
full-text search only when the catalog outgrows a single client-side window
(roughly low-thousands of open listings).

## 7. AI (not yet)

AI matching is intentionally **not** built here. Once data quality is proven, AI
may *explain* fit, flag résumé gaps, parse natural-language searches, and
generate weekly shortlists — but it must never invent job facts. The existing
`✨ AI Search` only parses a query into the structured filters above.

## Migration / deployment notes

- **Deploy rules + indexes:** `yarn deploy:rules` (adds the `jobRaw`,
  `ingestionRuns`, `sourceFetchLogs`, `savedJobs` rules and the new composite
  indexes for dedupe, saved jobs, and fetch logs).
- **Env:** set `FIREBASE_SERVICE_ACCOUNT_KEY` and `INGESTION_SECRET` (server-side)
  before running any ingestion. See `apps/web/.env.example`.
- **Scheduler:** add repo secrets `INGEST_RUN_URL` (`https://<domain>/api/ingest/run`)
  and `INGESTION_SECRET` for the `ingest.yml` workflow, or call the endpoint from
  any external scheduler.
- **Backfill of existing imported jobs:** docs created before this change lack
  `fingerprint`/`firstSeenAt`. They are healed on the next successful fetch of
  their source (fingerprint is written on every upsert; `firstSeenAt` is set on
  first create and left intact thereafter). No manual migration required.
- **Tests:** `yarn test:unit` (normalization) and `yarn test:rules` (emulator).
