# News feed (curated RSS)

The main feed at `/feed` merges two streams, newest first:

1. **User posts** — authored by the people you're connected to or follow (or the
   public stream when you're not connected to anyone yet).
2. **News** — headlines from a small set of curated RSS/Atom feeds.

News items are clearly differentiated from posts: a **News** badge, the source
name, and a link out to the original. Only the **headline and a short excerpt**
are ever stored or displayed — never the full article — and every card links
back to the source with attribution (`rel="noopener noreferrer nofollow"`).

## How it works

- **Feeds** are defined in `apps/web/lib/news/feeds.ts` (`NEWS_FEEDS`). Each entry
  is `{ name, url, sourceUrl?, category? }` and must point at a valid RSS 2.0 or
  Atom endpoint over HTTPS. Edit this list to add/remove sources.
- **Parsing** is dependency-free (`apps/web/lib/news/parse.ts`): it extracts only
  title, link, a truncated excerpt (~280 chars, HTML stripped), and a publish
  date. It tolerates CDATA, entities, and both feed dialects; anything it can't
  parse is skipped.
- **Ingestion** (`apps/web/lib/news/ingest.ts`) fetches every feed, dedupes by a
  sha256 of the canonical URL (so an article shared across feeds is stored once),
  and upserts into the `news` collection via the Admin SDK. A failing feed is
  logged and skipped — it never aborts the run.
- **Storage**: the `news` collection is **public-read, server-write-only** (see
  `firestore.rules`). Clients read it with `getNewsItems()`; they can never write.

## Running it

The route is `POST /api/ingest/news`, authorized exactly like the job-ingestion
routes — `Authorization: Bearer $INGESTION_SECRET`. It requires
`FIREBASE_SERVICE_ACCOUNT_KEY` and `INGESTION_SECRET` in the environment.

```bash
curl -X POST https://<your-domain>/api/ingest/news \
  -H "Authorization: Bearer $INGESTION_SECRET" \
  -H 'Content-Type: application/json'
```

Response:

```json
{ "feedsChecked": 3, "feedsFailed": 0, "itemsFound": 42, "itemsWritten": 40, "errors": [] }
```

## Scheduling

`.github/workflows/ingest.yml` has a `news` job that POSTs to the route on the
same 2-hourly schedule as job ingestion. It uses the `INGEST_NEWS_URL` secret, or
derives the URL from `INGEST_RUN_URL` when that isn't set. If the secrets aren't
configured, the job logs and skips (no failure).

## Adding a feed

1. Append an entry to `NEWS_FEEDS` in `apps/web/lib/news/feeds.ts`.
2. Confirm the URL returns RSS/Atom (not an HTML page).
3. Redeploy; the next scheduled run (or a manual `curl`) picks it up.

Keep the list to reputable sources whose terms permit headline + excerpt reuse
with attribution and a link back — which is all this feature stores or shows.
