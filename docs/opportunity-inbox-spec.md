# Spec: Private professional opportunity inbox

## Objective

Give authenticated JobMan gig workers a private list of home-service requests they can confidently evaluate, then let them express interest or pass without creating a match, quote, booking, message thread, payment, or payout.

Success means an eligible worker can understand why a request appeared, see only coarse customer information, and record one auditable response. Customers and other workers cannot read the inbox or response.

## Existing architecture

- Next.js 15 + React 18 + TypeScript + Tailwind web app in `apps/web`.
- Firebase Authentication, Firestore, and Storage.
- Client helpers use the Firebase browser SDK; protected APIs verify Firebase ID tokens and use the Admin SDK.
- Existing account roles are `worker` and `employer`; a home-service professional is a `worker` with a `profiles/{uid}` document whose `type` is `gig`.
- Service requests live in `serviceRequests`; private matching preferences live in `workerGigPreferences`.
- Unit tests use Node's built-in test runner. Firestore/Storage rules tests use the Firebase emulator.

## Immediate capability map

| Module | Responsibility | Depends on |
| --- | --- | --- |
| `opportunity-matcher` | Pure eligibility, distance, schedule, and integer-money calculations | existing service requests and gig preferences |
| `opportunity-api` | Authenticate workers, minimize fields, rerun eligibility, record immutable responses | `opportunity-matcher` |
| `opportunity-inbox` | Accessible states, explanations, interest/pass actions | `opportunity-api` |
| `opportunity-security` | Deny direct client access to responses/events and prove cross-account isolation | `opportunity-api` |

Build order: matcher -> API -> inbox -> rules and end-to-end verification.

## Matching contract

Hard eligibility is deterministic and precedes any future ranking:

1. The worker's gig-profile category must equal the request category.
2. Worker and request cities must resolve to supported coarse Bay Area city centres; their Haversine distance must be at or inside the worker's radius.
3. A requested date is required and must not be earlier than the matcher evaluation date. Weekend-only workers receive only Saturday/Sunday requests. Known blackout dates exclude a request.
4. Estimated duration must be a positive integer number of minutes.
5. The request must have a non-negative customer budget floor. This is used conservatively as the estimated gross, not as a quote or agreed price.
6. Known fees use integer minor units. During this read-only foundation release, the known JobMan fee is explicitly zero because no transaction is created. Unknown deductions are disclosed, not invented.
7. Estimated take-home is `estimated gross - known fees`. Estimated hourly take-home is `floor(take-home * 60 / duration minutes)`. It must be greater than or equal to the worker's minimum hourly take-home.

Missing required category, location, schedule, duration, price, currency, or preferences safely excludes the request with a stable reason code. Distance is approximate because city centres are used; no exact address is collected or returned.

## API contract

- `GET /api/opportunities?pageSize=20` returns only eligible opportunity cards and the caller's existing response.
- `POST /api/opportunities/{id}/responses` accepts `interested` or `passed` and an optional allowlisted pass reason.
- Every route derives the worker ID from the verified Firebase token and rechecks `users`, `profiles`, preferences, request status, and eligibility server-side.
- Responses use one deterministic Firestore document per worker/opportunity. Repeating the same response is idempotent; a conflicting response returns HTTP 409 and is not overwritten.
- Errors use `{ error: { code, message } }` and never reveal server internals.

## Privacy review

Professionals may see: request ID, category, redacted customer scope, city, approximate distance, requested date/window, estimated duration, conservative budget-floor gross, known fees, calculated take-home, currency, and explainable match reasons.

Professionals may not see: customer ID or name, email, phone, exact address, access instructions, payment details, fraud signals, other professionals, their responses, messages, or analytics records.

Browser clients cannot read full service-request documents for professionals, including after assignment. Professional discovery always goes through the authenticated server API and its explicit redacted field allowlist.

Scope text is rendered as text, length-limited, and redacted for common email, phone, street-address, and access-code patterns. This is defence in depth, not permission for customers to submit secrets.

## Observability questions

1. Are opportunities being shown, excluded, or failing calculation, and for which non-sensitive reason code?
2. Are professionals expressing interest or passing?
3. Are API authorization failures or calculation failures increasing?

Events contain only a stable event name, pseudonymous worker/request IDs needed for audit, bounded reason codes, request ID, and server timestamp. They never contain customer names, scope text, addresses, contact details, money, or tokens.

## Commands

- Type check: `yarn typecheck`
- Unit tests: `node --experimental-strip-types --test apps/web/lib/*.test.ts`
- Rules tests: `yarn test:rules`
- Production build: `yarn build`
- Development server: `yarn web`

## Boundaries

- Always: validate at the API boundary, derive ownership from the token, minimize returned fields, use integer money, preserve current user changes.
- Ask first: dependencies, production data changes, deployment, payments, address release, changing role semantics.
- Never: create bookings/quotes/messages/payments, trust caller IDs or eligibility, expose private customer data, weaken rules, commit secrets.

## Assumptions

- `worker` + gig profile is the smallest secure existing representation of a home-service professional.
- The pilot operates in supported San Francisco Bay Area cities; unsupported cities are excluded rather than geocoded or guessed.
- `full-time` and `part-time` are treated as date-compatible in this slice; `weekends` is restricted to weekends. Blackout support exists in the pure matcher and is a later persisted-preferences phase.
- Existing service requests without duration or a usable budget floor remain stored but are not eligible.
- A zero known platform fee is accurate only while this slice remains non-transactional; unknown materials, travel costs, taxes, and future fees are clearly excluded from the estimate.

## Success criteria

- Only authenticated worker + gig-profile accounts can load opportunities.
- Every returned request passes the same server-side matcher used when recording a response.
- No response can be duplicated, changed silently, or read across workers.
- Every card explains category, coarse distance, availability, and earnings inputs.
- Loading, empty, error, signed-out, unauthorized, responding, and responded states are visible and keyboard accessible.
- Unit, type, rules, build, and browser checks are run; any environment blocker is reported exactly.
