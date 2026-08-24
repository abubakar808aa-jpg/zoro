# Opportunity inbox tasks

## Task 1: Domain tests

**Acceptance:** Tests cover category, radius boundary, timezone/weekends, blackouts, threshold below/equal/above, invalid/missing inputs, integer rounding, stable reasons, privacy redaction, role authorization, and response transitions.

**Verify:** Focused Node test command fails before implementation and passes after it.

- [x] Complete

## Task 2: Pure matcher

**Acceptance:** Persistence-independent functions return explicit eligible/excluded unions, integer USD calculations, and display-safe explanations.

**Verify:** Focused tests and typecheck pass.

- [x] Complete

## Task 3: Private APIs

**Acceptance:** Token-derived worker access, minimized eligible results, server-side recheck, idempotent same-response replay, and HTTP 409 conflict behavior.

**Verify:** Contract/unit tests and typecheck pass.

- [x] Complete

## Task 4: Opportunity inbox UI

**Acceptance:** Accessible loading, empty, error, signed-out, unauthorized, eligible, responding, and responded states; no booking language or private customer fields.

**Verify:** Keyboard and 320/768/1024/1440 browser checks.

- [x] Complete

## Task 5: Rules and docs

**Acceptance:** Direct response/event reads and writes are denied to clients; roadmap, formula, privacy, assumptions, and risks are documented.

**Verify:** Emulator tests, build, and final diff review.

- [x] Complete

## Final checkpoint

- [x] Typecheck passes
- [x] Unit tests pass
- [x] Rules tests pass
- [x] Production build passes
- [x] Browser verification passes at all required widths
- [x] No booking, quoting, address disclosure, or payment behavior was added
