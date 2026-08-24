# Job board connectors

JobMan normalizes public employer listings into Firestore and links every listing to the employer's original application page. All requests below require the server-side `FIREBASE_SERVICE_ACCOUNT_KEY` and `INGESTION_SECRET` from `apps/web/.env.example`.

## Scheduled production refresh

`GET /api/cron/ingest` is called once per day by Vercel Cron. Vercel sends `CRON_SECRET` in the `Authorization` header, so the endpoint is not public. Every run writes a summary to `ingestionRuns` and one record per connector to `sourceFetchLogs`.

Active source records in Firestore and sources in `CONNECTOR_SOURCES_JSON` are refreshed automatically. The environment value is a JSON array:

```json
[
  { "provider": "greenhouse", "sourceKey": "figma", "companyName": "Figma" },
  { "provider": "lever", "sourceKey": "palantir", "companyName": "Palantir", "region": "global" },
  { "provider": "ashby", "sourceKey": "ramp", "companyName": "Ramp" },
  { "provider": "smartrecruiters", "sourceKey": "smartrecruiters", "companyName": "SmartRecruiters" },
  { "provider": "workable", "sourceKey": "commonapp", "companyName": "Common App" },
  { "provider": "recruitee", "sourceKey": "resourcefultalentgroup", "companyName": "Resourceful Talent Group" },
  { "provider": "personio", "sourceKey": "acme", "companyName": "Acme", "language": "en" },
  { "provider": "usajobs", "sourceKey": "bay-area-tech", "companyName": "U.S. Federal Government", "keyword": "technology", "location": "San Francisco, California", "maxPages": 3 },
  { "provider": "themuse", "sourceKey": "bay-area-services", "companyName": "The Muse marketplace", "category": "Installation, Maintenance, and Repairs", "location": "San Francisco, CA", "maxPages": 3 }
]
```

## Lever

Lever's public Posting API uses a **site name** (the part after `jobs.lever.co/`). It does not require a provider token.

```bash
curl -X POST https://<your-domain>/api/ingest/lever \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <INGESTION_SECRET>' \
  -d '{
    "boardToken": "acme",
    "companyName": "Acme",
    "careersUrl": "https://jobs.lever.co/acme"
  }'
```

Set `"region": "eu"` when the board is hosted on Lever's EU API.

## Ashby

Ashby's public Posting API uses the job-board name from `jobs.ashbyhq.com/<board-name>`. It does not require a provider token.

```bash
curl -X POST https://<your-domain>/api/ingest/ashby \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <INGESTION_SECRET>' \
  -d '{
    "boardToken": "acme",
    "companyName": "Acme",
    "careersUrl": "https://jobs.ashbyhq.com/acme"
  }'
```

## SmartRecruiters

SmartRecruiters' public Posting API uses the company identifier from
`careers.smartrecruiters.com/<company-identifier>`. Reading public postings does
not require a provider token. The connector is read-only and keeps the official
SmartRecruiters application URL on every imported role.

```bash
curl -X POST https://<your-domain>/api/ingest/smartrecruiters \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <INGESTION_SECRET>' \
  -d '{
    "sourceKey": "Acme",
    "companyName": "Acme",
    "careersUrl": "https://careers.smartrecruiters.com/Acme"
  }'
```

## Workable

Workable exposes published jobs through its public account endpoint. Use the
account slug from `apply.workable.com/<account-slug>`. JobMan keeps Workable's
official application URL and does not submit applications itself.

```bash
curl -X POST https://<your-domain>/api/ingest/workable \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <INGESTION_SECRET>' \
  -d '{
    "sourceKey": "acme",
    "companyName": "Acme",
    "careersUrl": "https://apply.workable.com/acme/"
  }'
```

Provider reference: https://help.workable.com/hc/en-us/articles/115012771647-Using-the-Workable-API-to-create-a-careers-page

## Recruitee

Recruitee's Careers Site API is public and does not require a token. Use the
subdomain from `<company>.recruitee.com`; the connector imports only published
offers and preserves `careers_apply_url` as the external application target.

```bash
curl -X POST https://<your-domain>/api/ingest/recruitee \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <INGESTION_SECRET>' \
  -d '{
    "sourceKey": "acme",
    "companyName": "Acme",
    "careersUrl": "https://acme.recruitee.com/"
  }'
```

Provider reference: https://docs.recruitee.com/reference/offers

## Personio

Personio publishes open roles as one public XML feed when the employer enables
the XML interface. Use the tenant from `<tenant>.jobs.personio.de`; `language`
may be `de`, `en`, `fr`, `es`, `nl`, `it`, or `pt`. The feed is complete rather
than paginated. JobMan validates and size-limits the XML, rejects document/entity
declarations, retries transient failures at most three times, normalizes HTML
descriptions, and sends every application to Personio's official
`https://<tenant>.jobs.personio.de/job/<id>` page.

```bash
curl -X POST https://<your-domain>/api/ingest/personio \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <INGESTION_SECRET>' \
  -d '{
    "sourceKey": "acme",
    "companyName": "Acme",
    "careersUrl": "https://acme.example/careers",
    "language": "en"
  }'
```

An empty successful feed is valid. Roles missing from three successful source
checks are closed by the shared ingestion lifecycle; a failed fetch never closes
jobs. Check `sourceFetchLogs` for status, duration, counts, and the structured
connector error, and `jobSources/personio_<tenant>` for the latest health fields.
If the endpoint returns `INVALID_XML`, first confirm the employer has enabled its
Personio XML interface and that the configured tenant is correct.

Provider references:

- https://support.personio.de/hc/en-us/articles/207576365-Integrate-jobs-from-Personio-into-your-website-via-XML
- https://developer.personio.de/docs/integration-of-open-positions

## USAJOBS

USAJOBS uses the official federal Search API. Create an API key at
`developer.usajobs.gov`, then set `USAJOBS_API_KEY` and the account email in
`USAJOBS_USER_AGENT` as server-only values. The connector follows the official
authentication headers, retries transient failures, and caps a source at five
pages/500 records per run. It marks records as federal, uses the hiring agency
as the employer for deduplication, and preserves both the USAJOBS detail URL and
official application URL.

```bash
curl -X POST https://<your-domain>/api/ingest/usajobs \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <INGESTION_SECRET>' \
  -d '{
    "sourceKey": "bay-area-tech",
    "keyword": "technology",
    "location": "San Francisco, California",
    "maxPages": 3
  }'
```

Provider reference: https://developer.usajobs.gov/api-reference/get-api-search

## The Muse

The Muse public jobs API returns 20 records per zero-based page. JobMan caps a
source at five pages, strips description markup, deduplicates by provider ID,
and labels The Muse landing page accurately as an external source listing. The
API works without a key at a lower documented limit, but The Muse asks apps to
register beyond testing; set an optional server-only `THE_MUSE_API_KEY` before
production use.

```bash
curl -X POST https://<your-domain>/api/ingest/themuse \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <INGESTION_SECRET>' \
  -d '{
    "sourceKey": "bay-area-services",
    "category": "Installation, Maintenance, and Repairs",
    "location": "San Francisco, CA",
    "maxPages": 3
  }'
```

Provider reference: https://www.themuse.com/developers/api/v2

## Operations

- Re-running a source updates its existing documents, so the same role is not duplicated.
- Aggregate sources use each normalized job's employer—not the marketplace name—in the shared fingerprint.
- The protected ingestion heartbeat also checks the four official economic-news feeds and writes separate health summaries to `newsIngestionRuns` and `newsSourceFetchLogs`.
- Schedule each source every 6–12 hours. Keep the secret in your scheduler or deployment environment, never in the browser.
- Start with a small employer allowlist. Respect each provider's terms, rate limits, and removal requests.

### Description quality

- Every connector converts provider HTML into plain, readable text before writing a job. Existing records are normalized again when cards and detail pages render, so older escaped HTML remains readable without rewriting production data.
- The normalizer keeps paragraphs, headings, and list bullets while removing tags, attributes, links, comments, scripts, styles, and malformed active-content blocks.
- Do not render provider HTML with `dangerouslySetInnerHTML`. If rich HTML is added later, use an established sanitizer with an explicit tag and attribute allowlist first.

### Outbound-click health

- Job cards and imported-job detail pages emit `job_apply_click`; feed source links emit `news_open`.
- Delivery first uses `navigator.sendBeacon`, then falls back to a non-blocking `fetch` request with `keepalive: true` when the browser declines the beacon. A failed counter never blocks the external destination.
- `/api/events` accepts only the minimal allowlisted event fields. News events store the generated news ID and source name; they do not send or store full article URLs. Job events verify the imported job server-side and store only its provider/source metadata and destination hostname.
- In staging, inspect the `/api/events` request in the browser network panel and confirm a `204` response. Do not click production links merely to manufacture monitoring data.
- After real traffic, monitor `interactionEvents` by `type` and `createdAt`. A quiet 24-hour window is not automatically a tracking outage; distinguish zero traffic from delivery errors using browser/network checks and server logs.
