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

Copy `apps/web/.env.example` to `apps/web/.env.local`, then configure Firebase and any optional AI integration. Server-side job ingestion additionally needs `FIREBASE_SERVICE_ACCOUNT_KEY` and `INGESTION_SECRET`. Scheduled production refreshes use `CRON_SECRET`; the included daily cron imports public listings from Greenhouse, Lever, and Ashby starter boards and writes a per-source audit log. `CONNECTOR_SOURCES_JSON` can add more employer boards without changing code.

The web app includes a mixed `/feed`: community activity from people a user follows plus short career-news previews that link to the original publisher. Optional news sources can be configured through `NEWS_RSS_FEEDS`.

Read [the setup guide](SETUP.md) for Firebase setup and [the documentation index](docs/README.md) for job-board ingestion.
