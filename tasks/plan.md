# Implementation Plan: Opportunity inbox foundation

## Overview

Implement one read-only marketplace slice: deterministic eligibility, a private worker API, a professional inbox, and immutable interest/pass responses. Preserve existing booking and payment boundaries.

## Architecture decisions

- Use `worker` + `gig` profile as the existing professional role; do not add a competing role.
- Keep matching pure and persistence-free; adapters validate Firestore documents before calling it.
- Use city-centre coordinates for coarse pilot distance. Do not collect or disclose exact addresses.
- Use the customer budget floor as a clearly labelled conservative gross estimate, never as a quote.
- Keep response and telemetry collections server-only. API payloads are explicit allowlists.
- Add no dependencies.

## Dependency graph

`types and matcher` -> `authorization and API` -> `inbox UI` -> `rules/docs/browser verification`

## Task list

### Phase 1: Contract and domain

- Task 1: Add failing matcher, privacy, role, and response-transition tests.
- Task 2: Implement typed pure matching, money, location, schedule, and redaction functions.

### Checkpoint: Domain

- Focused tests pass and type checking is clean.

### Phase 2: Secure vertical slice

- Task 3: Implement authenticated list endpoint with minimized DTOs and privacy-safe events.
- Task 4: Implement transactional, idempotent interest/pass endpoint.
- Task 5: Add responsive inbox UI and short navigation paths.

### Checkpoint: Vertical slice

- Signed-out, unauthorized, empty, error, eligible, interest, pass, idempotent, and conflict paths are handled.

### Phase 3: Security and documentation

- Task 6: Harden Firestore rules and emulator tests for response/event isolation.
- Task 7: Update the phased roadmap, matching formula, privacy review, and assumptions.
- Task 8: Run formatting checks available in the repo, typecheck, unit/rules tests, build, and four-width browser verification.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Old requests lack duration | Empty inbox for old data | Safe exclusion; new intake adds explicit duration |
| City-centre distance is approximate | Borderline travel estimate | Label approximation and use strict radius boundary |
| Scope contains contact/address text | Privacy leak | Server redaction plus field allowlist; never return customer identity |
| Client forges eligibility or worker ID | Cross-account disclosure | Derive UID from token and rerun matcher server-side |
| Repeated clicks duplicate/conflict | Bad audit state | Deterministic response ID and Firestore transaction |
| Firebase emulator needs Java locally | Rules tests are skipped on an unprepared machine | Document the command; verified this workspace with local Java 21 and the demo-only emulators |
| Firebase test SDK has an `undici` advisory | Test tooling could be affected by hostile network responses | Keep the rules suite isolated from production and upgrade the test SDK in a follow-up dependency-maintenance slice |

## Open questions deferred safely

- Exact weekly hours and persisted blackout dates belong to the next availability slice.
- Future JobMan fees, materials, tax, and travel-cost policy must be defined before commerce.
- Customer role separation from the current `employer` account type needs a dedicated migration plan.
