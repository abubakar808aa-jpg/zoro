# JobMan Home Services: Foundation and Launch Plan

## Product promise

Help San Francisco Bay Area home-service professionals earn more predictable weekly income by sending them nearby work that is actually worth taking. Customers should be able to describe a problem, approve a quote, book a professional, and pay through JobMan without mystery fees or mystery people.

## Pilot scope

- Market: San Francisco Bay Area, starting with one compact service zone.
- Initial supply: 20–30 professionals.
- Initial categories: cleaners and handymen.
- Long-term north star: median verified weekly take-home earnings per active professional.
- MVP success signal: at least 60% of newly onboarded professionals complete a paid booking within 14 days.
- Guardrails: take-home hourly rate, cancellation rate, dispute rate, repeat bookings, safety incidents, and worker satisfaction.

## Feature list

### Foundation added in this slice

- [x] Private customer service-request contract.
- [x] Private worker service area, travel radius, and minimum take-home preferences.
- [x] Profit-first earnings calculator for fees, travel, materials, and time.
- [x] Customer request form for home services in the Bay Area.
- [x] Clear disclosure that payments are not active yet.
- [x] Firestore rules that prevent strangers from reading service requests.
- [x] Firestore rules that keep a worker's earnings floor out of their public profile.
- [x] Playful customer copy and explicit success/error states.
- [x] Home-services entry points in navigation, the home page, gig page, and footer.

### MVP features we are adding next

- [ ] Customer accounts with a clearly defined customer role.
- [ ] Professional availability calendar and blackout dates.
- [ ] Customer request dashboard with status history.
- [ ] Worker opportunity inbox with accept/pass feedback.
- [ ] Explainable matching using category, service area, radius, schedule, and earnings floor.
- [ ] Quote creation, revision, expiration, and customer approval.
- [ ] Private address sharing only after an approved match or booking.
- [ ] Booking lifecycle: requested, quoted, booked, in progress, completed, cancelled.
- [ ] Stripe Connect onboarding for professional payouts.
- [ ] Test-mode customer payments with idempotency protection.
- [ ] Refund, cancellation, no-show, and dispute workflows.
- [ ] Booking receipts and payout history.
- [ ] Booking-linked conversations and notifications.
- [ ] Two-sided reviews after completed bookings only.
- [ ] Admin tools for disputes, fraud flags, refunds, and safety escalations.
- [ ] Interaction and marketplace-health events that contain no unnecessary personal data.

### AI features after the core workflow is trustworthy

- [ ] Text and voice request assistant that converts a messy explanation into a structured scope.
- [ ] Photo-assisted intake with safe file validation and explicit customer consent.
- [ ] Price-range guidance labelled as an estimate, with professional approval required.
- [ ] Worker-facing estimated take-home card with transparent inputs.
- [ ] Accept/pass learning that never penalizes workers for declining a gig.
- [ ] Daily route suggestions that reduce unpaid driving.
- [ ] Recurring-service recommendations that favour the customer's existing professional.
- [ ] Skills-to-income coach based on observed local demand.
- [ ] Scam, unsafe-request, and scope-creep warnings.
- [ ] Portable reputation assistant that organizes evidence but never invents credentials.

### Later, not part of the first launch

- [ ] Multi-professional crews for larger projects.
- [ ] Property-manager subscriptions and recurring maintenance plans.
- [ ] Multi-city expansion.
- [ ] Automated job acceptance.
- [ ] Dynamic worker pricing controlled by JobMan.

Automated acceptance and opaque pricing are intentionally excluded. Professionals choose their work and approve their price.

## Launch checklist

The app should not accept real home-service payments until every blocking item is complete.

### 1. Validate the marketplace

- [ ] Interview at least 15 Bay Area cleaners and handymen.
- [ ] Interview at least 15 customers who hired home-service professionals in the last year.
- [ ] Confirm the three most common service requests and the information needed to quote them.
- [ ] Record workers' current weekly earnings, unpaid search time, driving time, and cancellation pain.
- [ ] Recruit 20–30 pilot professionals in one compact service zone.
- [ ] Confirm enough customer demand exists before expanding categories or geography.
- [ ] Test whether workers understand and trust the take-home estimate.

### 2. Define marketplace operations

- [ ] Decide who is the merchant of record and document the consequences.
- [ ] Get qualified California legal advice on marketplace terms, worker classification, licences, taxes, and required disclosures.
- [ ] Decide which services require a licence, insurance, background check, or other verification.
- [ ] Write cancellation, refund, no-show, property-damage, and dispute policies.
- [ ] Define what JobMan support handles and its response times.
- [ ] Create an incident-escalation process for urgent safety issues.
- [ ] Confirm commercial insurance requirements for JobMan and participating professionals.

### 3. Finish trust and safety

- [ ] Verify customer email and phone before booking.
- [ ] Verify professional identity before receiving requests or payouts.
- [ ] Verify applicable licences and show their status and expiry clearly.
- [ ] Prevent reviews from being created without a completed JobMan booking.
- [ ] Let professionals report and block customers.
- [ ] Let customers report professionals and unsafe service outcomes.
- [ ] Add fraud, spam, duplicate-request, and suspicious-payment controls.
- [ ] Create a human review queue; AI may flag risks but must not make final safety decisions alone.
- [ ] Test emergency and severe-incident handling with written scenarios.

### 4. Finish payments and payouts

- [ ] Implement Stripe Connect rather than reusing the boosted-listing checkout.
- [ ] Onboard professionals as connected accounts in test mode.
- [ ] Choose and document the charge and payout model.
- [ ] Add webhook signature verification and replay-safe, idempotent handlers.
- [ ] Prevent duplicate bookings, duplicate charges, and duplicate payouts.
- [ ] Test successful payment, failed payment, delayed payment, refund, partial refund, dispute, and payout failure.
- [ ] Display every JobMan fee before the customer and professional agree.
- [ ] Reconcile each booking, charge, refund, fee, transfer, and payout.
- [ ] Establish tax-reporting and payout-support processes.
- [ ] Keep production payment keys out of source control and restrict their access.

### 5. Protect customer and worker data

- [ ] Keep exact addresses private until needed for an approved booking.
- [ ] Classify every stored field by purpose and sensitivity.
- [ ] Set retention periods for requests, messages, photos, addresses, payment references, and analytics.
- [ ] Implement account export, correction, and deletion workflows.
- [ ] Obtain consent before sending personal information or images to an AI provider.
- [ ] Do not place access codes, passwords, payment details, or unnecessary personal data in AI prompts.
- [ ] Add safe image types, size limits, malware precautions, and deletion to photo intake.
- [ ] Review Firebase and Storage rules with emulator tests.
- [ ] Add server-side validation and rate limiting to every new mutation endpoint.
- [ ] Review security headers, permissions, environment variables, and dependency audit findings.

### 6. Make AI honest and affordable

- [ ] Keep matching and earnings arithmetic deterministic and testable.
- [ ] Treat model output as untrusted data and validate it before storage or display.
- [ ] Label generated scopes and prices as estimates.
- [ ] Require customer and professional confirmation before a booking or price change.
- [ ] Measure AI error rates on real pilot requests.
- [ ] Provide a non-AI fallback when the model is unavailable.
- [ ] Cache repeated results and place cost limits on AI calls.
- [ ] Keep the provider replaceable; use local AI during development where practical.
- [ ] Test for fabricated services, unsafe advice, discriminatory results, and prompt injection.

### 7. Product quality

- [ ] Complete the full customer request-to-payment journey in staging.
- [ ] Complete the full professional onboarding-to-payout journey in staging.
- [ ] Verify loading, empty, signed-out, unauthorized, offline, and error states.
- [ ] Test keyboard navigation and screen-reader labels.
- [ ] Test at 320px, 768px, 1024px, and 1440px widths.
- [ ] Test current Chrome, Safari, Firefox, and mobile browsers.
- [ ] Confirm reduced-motion behaviour and sufficient colour contrast.
- [ ] Run type checking, unit tests, Firestore rules tests, and a production build in CI.
- [ ] Run user acceptance testing with pilot customers and professionals.

### 8. Observability and support

- [ ] Track request creation, match shown, quote sent, quote accepted, booking paid, work completed, refund, dispute, and payout.
- [ ] Track time to first paid booking and verified weekly take-home earnings.
- [ ] Track matching failures, payment failures, webhook failures, notification failures, and AI fallbacks.
- [ ] Create alerts for stuck bookings, duplicate payment attempts, payout failures, and unusual dispute rates.
- [ ] Remove personal information from logs and analytics.
- [ ] Create customer and professional support views with an audit history.

### 9. Staged launch

- [ ] Deploy to a separate staging environment with test payment credentials.
- [ ] Seed staging with realistic but fictional data.
- [ ] Run exploratory testing and a written UAT script.
- [ ] Fix every launch-blocking issue and document accepted lower-priority risks.
- [ ] Prepare a rollback plan and disable-payment switch.
- [ ] Launch to the invited pilot only.
- [ ] Review marketplace health daily during the pilot.
- [ ] Expand categories or geography only after supply, demand, earnings, safety, and support targets are healthy.

## Immediate next build slice

Build a private worker opportunity inbox and an explainable matcher using service category, service area, radius, schedule, and minimum hourly take-home. Keep the result read-only: workers can pass or express interest, but no booking or payment should occur until quoting and payment protections are complete.
