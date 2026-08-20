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
  { "provider": "bamboohr", "sourceKey": "acme", "companyName": "Acme" },
  { "provider": "personio", "sourceKey": "acme", "companyName": "Acme" },
  { "provider": "remotive", "sourceKey": "remotive", "companyName": "Remotive" },
  { "provider": "arbeitnow", "sourceKey": "arbeitnow", "companyName": "Arbeitnow" }
]
```

Connectors come in two shapes. **Per-company boards** (Greenhouse, Lever, Ashby,
SmartRecruiters, Workable, Recruitee, BambooHR, Personio) import one employer's
roles, and `companyName` is the employer. **Aggregators** (Remotive, Arbeitnow)
import roles from many employers through a single free endpoint; there
`companyName` is only a label for the source registry, because each imported job
keeps its own employer name.

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

## BambooHR

BambooHR publishes each customer's careers page as a public JSON endpoint. Use the
subdomain from `<subdomain>.bamboohr.com/careers`. No provider token is required.
The list endpoint omits descriptions, so the connector fetches each job's detail
page in small batches and keeps BambooHR's own application URL.

```bash
curl -X POST https://<your-domain>/api/ingest/bamboohr \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <INGESTION_SECRET>' \
  -d '{
    "boardToken": "acme",
    "companyName": "Acme",
    "careersUrl": "https://acme.bamboohr.com/careers"
  }'
```

## Personio

Personio exposes published positions as a public XML feed at
`https://<company>.jobs.personio.de/xml`. Use the company slug as `sourceKey`; no
provider token is required.

```bash
curl -X POST https://<your-domain>/api/ingest/personio \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <INGESTION_SECRET>' \
  -d '{
    "sourceKey": "acme",
    "companyName": "Acme",
    "careersUrl": "https://acme.jobs.personio.com"
  }'
```

## Remotive (aggregator)

Remotive's public API returns remote roles across many employers and needs no
token or board identifier. Every imported job keeps its own `company_name` and
links back to the Remotive listing. Pass an optional `category` to narrow the
import.

```bash
curl -X POST https://<your-domain>/api/ingest/remotive \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <INGESTION_SECRET>' \
  -d '{ "category": "software-dev" }'
```

Provider reference: https://remotive.com/api/remote-jobs

## Arbeitnow (aggregator)

Arbeitnow's public job-board API returns roles from many employers with no token.
As with Remotive, each imported job keeps its own employer name. The body is
optional.

```bash
curl -X POST https://<your-domain>/api/ingest/arbeitnow \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <INGESTION_SECRET>' \
  -d '{}'
```

Provider reference: https://www.arbeitnow.com/api/job-board-api

## Operations

- Re-running a source updates its existing documents, so the same role is not duplicated.
- Schedule each source every 6–12 hours. Keep the secret in your scheduler or deployment environment, never in the browser.
- Start with a small employer allowlist. Respect each provider's terms, rate limits, and removal requests.
