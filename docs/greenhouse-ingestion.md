# Greenhouse job ingestion

JobMan indexes public Greenhouse job boards and always sends applicants to the employer's original application URL.

## Configure

1. Copy `apps/web/.env.example` to `apps/web/.env.local`.
2. Set `FIREBASE_SERVICE_ACCOUNT_KEY` to a one-line Firebase service-account JSON key.
3. Generate a long random `INGESTION_SECRET` and keep it server-side.
4. Deploy the Firestore rules with `firebase deploy --only firestore:rules`.

## Ingest one company

Use an employer's public Greenhouse board token. For a board URL such as `https://boards.greenhouse.io/acme`, the token is `acme`.

```bash
curl -X POST https://<your-domain>/api/ingest/greenhouse \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <INGESTION_SECRET>' \
  -d '{
    "boardToken": "acme",
    "companyName": "Acme",
    "careersUrl": "https://boards.greenhouse.io/acme"
  }'
```

The response reports how many public roles were imported. Re-running the same source updates the same Firestore documents, avoiding duplicates.

## Scheduling

Call the endpoint from a scheduler every 6–12 hours per source. Start with a small, hand-curated source list and store each source in the `jobSources` collection. Do not call the endpoint from a browser or expose `INGESTION_SECRET` to users.
