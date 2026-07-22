# JobMan — Launch Checklist (detailed steps)

## Task 1 — Deploy Firestore Indexes + Security Rules (~5 min)

Indexes and rules now live in the repo (`firestore.indexes.json`, `firestore.rules`, `storage.rules`) and deploy with one command — no console copy-paste:

```bash
npm install -g firebase-tools   # once
firebase login                  # once
yarn deploy:rules               # deploys rules + indexes + storage rules
```

Indexes show "Building…" in the console for 1–2 minutes, then "Enabled".

> The deployed rules are locked down: only job owners can edit/close their jobs, applications are visible only to the applicant and the job poster, and conversation messages only to participants. Do NOT replace them with test-mode rules.

## Task 2 — Full End-to-End Test (~15 min)

**As a worker:**
1. localhost:3000 → Get Started → choose **Worker** → sign up (email A)
2. Dashboard → **🔨 Gig Profile** → pick a category, click **✨ Write with AI**
3. Fill rate + state → Create Profile
4. Check Firebase Console → Firestore: `users` and `profiles` collections exist
5. Sign out (avatar → Sign Out)

**As an employer:**
6. Sign up again → choose **Employer** (different email B)
7. **Post a Job** → type one sentence in the purple AI box → **✨ Generate** → review → Post
8. Go to **Gig Workers** tab → open the worker's profile → **Send Message**
9. Send a text + attach a photo (📎)

**Back as the worker:**
10. Sign out, sign in with email A → Messages (note the unread dot) → reply (try the ✨ suggestions)
11. Jobs tab → open the employer's job → **✨ Write with AI** cover letter → Apply
12. Dashboard → check **My Applications** shows the application as *pending*

**Back as the employer:**
13. Dashboard → My Job Postings → click **👥 1 applicant** → read the cover letter → **✓ Accept**
14. Try **Close** on the job → confirm it disappears from the public Jobs list

If every step works, your marketplace is fully functional.

## Task 3 — Run the Mobile App (~10 min)

1. On your phone: install **Expo Go** (App Store / Play Store)
2. In Terminal:
   ```bash
   cd ~/Desktop/JobMan/apps/mobile
   npx expo start
   ```
3. Scan the QR code (iPhone: Camera app; Android: inside Expo Go)
4. Phone and Mac must be on the same Wi-Fi

**Google sign-in on mobile** (email sign-in works without this):
1. https://console.cloud.google.com → select the `jobman` project
2. **APIs & Services → Credentials** → under "OAuth 2.0 Client IDs" copy the **Web client** ID
3. Paste it into `packages/shared/src/firebase/config.ts` as `GOOGLE_WEB_CLIENT_ID`

## Task 4 — Deploy the Website (Vercel, free)

1. Create accounts: github.com and vercel.com (sign in to Vercel *with* GitHub)
2. Push the code (`.env.local` is gitignored — your API key will NOT be uploaded)
3. Vercel → **Add New… → Project** → Import the repo
4. Set **Root Directory** to `apps/web` (leave "Include source files outside of the Root Directory" enabled — the app imports from `packages/shared`)
5. **Environment Variables**: add everything from `apps/web/.env.example` — at minimum `ANTHROPIC_API_KEY`
6. Deploy → you get `jobman-xyz.vercel.app`
7. **IMPORTANT:** Firebase Console → Authentication → Settings →
   **Authorized domains** → Add your vercel.app domain (sign-in breaks without this)

**Custom domain:** buy at namecheap.com (e.g. getjobman.com, ~$10/yr) →
Vercel project → Settings → Domains → Add → follow the DNS instructions →
also add the domain to Firebase Authorized domains.

## Task 5 — CI (already set up)

`.github/workflows/ci.yml` runs typecheck + web build on every push and PR.
Nothing to do — just keep it green. When you add a test framework, wire it
into the same workflow.

## Notes on the AI features

- `/api/ai` requires a signed-in user (Firebase ID token) and rate-limits each
  user to 20 AI calls/minute — your Anthropic key can't be drained by
  anonymous traffic.
- Model is configurable via the `AI_MODEL` env var (default `claude-haiku-4-5`).
- New AI features: **Vibe Check** (job-fit score on job pages), **Skill Gaps**
  (after applying), and **Salary Intel** ("Is this pay fair?"). No extra setup —
  they use the same route and key.

## Task 6 — Enable payments (boosted listings)

1. Create a Stripe account → https://dashboard.stripe.com/apikeys → copy the
   **Secret key** into `STRIPE_SECRET_KEY` (start with test mode).
2. Dashboard → Developers → **Webhooks** → Add endpoint:
   `https://<your-domain>/api/stripe/webhook`, event `checkout.session.completed`.
   Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
3. Firebase Console → Project Settings → **Service accounts** → Generate new
   private key → paste the JSON (one line) into `FIREBASE_SERVICE_ACCOUNT_KEY`.
   (The webhook needs it to mark jobs as boosted.)
4. Test with card `4242 4242 4242 4242` — the job should show **⚡ Featured**
   and jump to the top of the Jobs page for 7 days. You keep 100% of the $5.

## Task 7 — Make yourself admin

1. Firebase Console → Firestore → `users` → your user doc → add field
   `isAdmin` (boolean) = `true`.
2. Reload the app → avatar menu now shows **🛡️ Admin** → moderation dashboard
   (ban users, remove jobs, handle reports).
   Only ever set this field from the console — the security rules prevent
   anyone from granting it to themselves.

## Task 8 — LinkedIn import (optional)

1. https://linkedin.com/developers → Create app → add the product
   **"Sign In with LinkedIn using OpenID Connect"**.
2. Auth tab → add redirect URL: `https://<your-domain>/api/linkedin/callback`
   (and `http://localhost:3000/api/linkedin/callback` for dev).
3. Set `NEXT_PUBLIC_LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`.
   The "Import from LinkedIn" button appears automatically on profile pages.

## New since v1

- **Daily themes**: the app's colors rotate through 7 palettes (one per
  weekday) automatically. Nothing to configure.
- **Feed + follows**: users follow each other from profiles; `/feed` shows
  job posts, hires, new joins, and career tips from people they follow.
- **Report flag** on feed posts feeds the admin Reports queue.
- Remember to run `yarn deploy:rules` again — rules and indexes changed.
