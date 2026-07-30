# Job board connectors

JobMan normalizes public employer listings into Firestore and links every listing to the employer's original application page. All requests below require the server-side `FIREBASE_SERVICE_ACCOUNT_KEY` and `INGESTION_SECRET` from `apps/web/.env.example`.

## Scheduled production refresh

`GET /api/cron/ingest` is called once per day by Vercel Cron. Vercel sends `CRON_SECRET` in the `Authorization` header, so the endpoint is not public. Every run writes a summary to `ingestionRuns` and one record per connector to `sourceFetchLogs`.

Active source records in Firestore and sources in `CONNECTOR_SOURCES_JSON` are refreshed automatically. The environment value is a JSON array:

```json
[
  { "provider": "greenhouse", "sourceKey": "figma", "companyName": "Figma" },
  { "provider": "lever", "sourceKey": "plaid", "companyName": "Plaid", "region": "global" },
  { "provider": "ashby", "sourceKey": "ramp", "companyName": "Ramp" },
  { "provider": "smartrecruiters", "sourceKey": "smartrecruiters", "companyName": "SmartRecruiters" }
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

## Operations

- Re-running a source updates its existing documents, so the same role is not duplicated.
- Schedule each source every 6–12 hours. Keep the secret in your scheduler or deployment environment, never in the browser.
- Start with a small employer allowlist. Respect each provider's terms, rate limits, and removal requests.
