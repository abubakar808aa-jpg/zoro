# JobMan home-services roadmap

Launch order is dependency-driven. A later phase does not start until the previous phase's gate is met.

## Phase 0 — Discovery foundation (launch-blocking, this slice)

- Private professional opportunity inbox.
- Deterministic category, coarse distance, availability, and take-home eligibility.
- Explainable match reasons and immutable interest/pass responses.
- Privacy-minimized APIs, Firestore isolation, telemetry, and tests.

Gate: authorization, privacy, matcher, rules, build, and responsive browser checks pass. Interest creates no commerce state.

## Phase 1 — Accounts, availability, and customer control (launch-blocking)

- Explicit customer role migration from today's broad employer role.
- Weekly professional availability, timezone, and blackout dates.
- Customer request dashboard and append-only status history.
- Customer email/phone verification; professional identity/licence/insurance status where applicable.
- Reporting, blocking, human safety-review queue, data export/correction/deletion, and retention policy.
- Server validation, rate limits, security headers, dependency audit, and full Firebase rules review.

Dependencies: Phase 0 response model and audit events.

Gate: each actor can see and mutate only their own records; safety and deletion workflows pass UAT.

## Phase 2 — Quotes, private contact, and booking (launch-blocking)

- Quote create/revise/expire/approve with professional-controlled pricing.
- Release exact address only after explicit customer approval and approved match/booking.
- Booking lifecycle: requested, quoted, booked, in progress, completed, cancelled.
- Booking-linked conversations and notifications.
- Cancellation, no-show, reporting, fraud/spam/duplicate-request controls.

Dependencies: verified roles, availability, audit history, safety controls.

Gate: duplicate bookings are impossible; address access is auditable and revocable; state-machine and notification tests pass.

## Phase 3 — Test-mode payments and operations (launch-blocking before real money)

- Stripe Connect onboarding and professional payout readiness.
- Test-mode customer payments only, with idempotency keys and replay-safe verified webhooks.
- Refund, cancellation, dispute, receipt, payout-history, and financial-reconciliation workflows.
- Duplicate charge/transfer/payout prevention and a payment-disable switch.
- Admin tools for disputes, refunds, fraud flags, and safety escalations.
- Staging, UAT, monitoring, alerts, rollback, and incident runbooks.

Dependencies: stable approved booking state and verified identities.

Gate: test-mode reconciliation is exact, webhook replay tests pass, rollback and payment-disable drills succeed, and a human approves real-money launch.

## Phase 4 — Trust and retention (launch enhancement)

- Two-sided reviews only after completed bookings.
- Privacy-safe marketplace-health metrics.
- Relationship-first recurring-service recommendations.
- Reputation assistant that never invents credentials.

Dependencies: completed bookings and trustworthy review eligibility.

## Phase 5 — Assistive AI (later enhancement)

- Text/voice request structuring and consent-based validated photo intake.
- Labelled price ranges requiring professional approval.
- Transparent take-home cards, non-punitive accept/pass learning, route suggestions, skills-to-income coaching, and scam/scope-creep warnings.

Gate: humans retain acceptance and price control; model output is validated and never drives eligibility or money calculations.

## Explicitly later

- Multi-professional crews.
- Property-manager subscriptions.
- Multi-city expansion.
- Automated job acceptance.
- JobMan-controlled dynamic professional pricing.
