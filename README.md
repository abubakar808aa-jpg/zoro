# JobMan

JobMan is a job-discovery marketplace with a Next.js web app, an Expo mobile app, Firebase-backed user data, and server-side connectors for employer job boards.

## Workspace layout

| Path | Purpose |
| --- | --- |
| `apps/web` | Next.js website and server-side ingestion routes |
| `apps/mobile` | Expo mobile app |
| `packages/shared` | Shared types, Firebase config, categories, and matching utilities |
| `docs` | Connector and operational documentation |
| `firestore.rules` | Browser-access rules for Firestore |

## Common commands

```bash
yarn web          # Start the web app
yarn mobile       # Start the Expo app
yarn typecheck    # Check web TypeScript types
yarn build        # Create the web production build
yarn validate     # Run type checking and the production build
```

## Configuration

Copy `apps/web/.env.example` to `apps/web/.env.local`, then configure Firebase and any optional AI integration. Server-side job ingestion additionally needs `FIREBASE_SERVICE_ACCOUNT_KEY` and `INGESTION_SECRET`. Scheduled production refreshes use `CRON_SECRET`; the included daily cron imports public listings from the starter boards and writes a per-source audit log. `CONNECTOR_SOURCES_JSON` can add more employer boards without changing code.

Job connectors come in two shapes: per-company ATS boards (Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee, BambooHR, Personio) and free multi-company aggregators (Remotive, Arbeitnow). All are public and need no provider credentials — see [the connector guide](docs/job-board-connectors.md).

The web app includes a mixed `/feed`: community activity from people a user follows plus short career-news previews that link to the original publisher. News is read from free, no-auth RSS/Atom feeds (US Bureau of Labor Statistics, Department of Labor, Indeed Hiring Lab, and more); `NEWS_RSS_FEEDS` replaces that list, and `NEWS_HTML_SOURCES` adds publishers that have no feed by scraping their article metadata.

Read [the setup guide](SETUP.md) for Firebase setup and [the documentation index](docs/README.md) for job-board ingestion.
