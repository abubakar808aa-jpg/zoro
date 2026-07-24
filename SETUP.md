# JobMan — Firebase Setup Guide

> The repository is a Yarn workspace. Run commands from the repository root with `yarn`, rather than installing dependencies separately inside each app.

Follow these steps once to connect JobMan to Firebase.

---

## Step 1 — Create a Firebase Project

1. Go to https://console.firebase.google.com
2. Click **Add project** → name it `jobman` → Continue
3. Disable Google Analytics if you don't need it → **Create project**

---

## Step 2 — Enable Authentication

1. In the Firebase console, click **Authentication** → **Get started**
2. Under **Sign-in method**, enable:
   - **Email/Password** — toggle ON → Save
   - **Google** — toggle ON → add your support email → Save

---

## Step 3 — Create Firestore Database

1. Click **Firestore Database** → **Create database**
2. Choose the production mode option, then deploy the repository's checked-in rules in Step 9.
3. Pick the region closest to your users (e.g., `us-central`)

---

## Step 4 — Enable Storage

1. Click **Storage** → **Get started**
2. Start in test mode → choose region → Done

---

## Step 5 — Get your Config Keys

1. Click the gear icon ⚙️ → **Project settings**
2. Scroll to **Your apps** → click the **</>** (Web) icon
3. Register the app → name it `JobMan Web`
4. Copy the `firebaseConfig` object shown

---

## Step 6 — Put Config in Environment Files (not source)

Config lives in `.env` files, **not** in the code. Each file is gitignored, so
your keys never get committed. Copy the two examples and fill in the values from
the `firebaseConfig` object you just copied:

```bash
cp apps/web/.env.example apps/web/.env.local      # website (Next.js)
cp apps/mobile/.env.example apps/mobile/.env       # mobile (Expo)
```

**Website** — `apps/web/.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIza…
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abc123
```

**Mobile** — `apps/mobile/.env` (same values, `EXPO_PUBLIC_` prefix):

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=AIza…
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
EXPO_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abc123
```

> The web apiKey is a **public** project identifier, not a secret — it's safe in
> the browser bundle, and access is controlled by the Firestore/Storage security
> rules. It lives in `.env` so each environment (local, Vercel, CI) supplies its
> own project, not because it needs hiding.

On **Vercel**, set the same `NEXT_PUBLIC_FIREBASE_*` variables under
**Project Settings → Environment Variables** instead of a `.env.local` file.

---

## Step 7 — Google OAuth Client ID (for Mobile)

1. Go to https://console.cloud.google.com
2. Select your Firebase project
3. Navigate to **APIs & Services** → **Credentials**
4. Find the **OAuth 2.0 Client ID** for type **Web application**
5. Copy the Client ID into `apps/mobile/.env`:

```bash
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
```

(Email sign-in works without this — it's only needed for Google sign-in.)

---

## Step 8 — Deploy Security Rules & Indexes

Rules and composite indexes live in the repo (`firestore.rules`,
`firestore.indexes.json`, `storage.rules`) — deploy them with one command
instead of clicking around the console:

```bash
npm install -g firebase-tools   # once
firebase login                  # once
yarn deploy:rules               # rules + indexes + storage rules
```

> The rules are locked down (see `firestore.rules`). Do **not** start Firestore
> in test mode for production. You can verify the rules locally with
> `yarn test:rules`, which runs them against the Firebase emulator.

---

## Step 9 — Run the Apps

### Website
```bash
yarn
yarn web
# Opens at http://localhost:3000
```

### Mobile (iOS & Android)
```bash
yarn mobile
# Scan QR code with Expo Go app on your phone
```

### Server-side job ingestion

Copy `apps/web/.env.example` to `apps/web/.env.local`. In addition to the public Firebase web configuration, ingestion needs:

- `FIREBASE_SERVICE_ACCOUNT_KEY`: one-line Firebase service-account JSON.
- `INGESTION_SECRET`: a long random value used only by server-to-server ingestion calls.

Read [the connector documentation](docs/README.md) for Greenhouse, Lever, Ashby, and SmartRecruiters.

---

## Firestore Data Structure (Reference)

```
users/{uid}
  name, email, photoURL, accountType, createdAt

profiles/{uid}
  type: 'gig' | 'professional'
  name, bio, skills[], location
  -- gig: category, hourlyRate, availability
  -- professional: title, category, experienceYears, education[], experience[]

jobs/{id}
  title, description, type, category, location, remote
  salary: { min, max, period }
  skills[], requirements[]
  postedBy, postedByName, status, applicantCount, createdAt

applications/{id}
  jobId, applicantId, applicantName, coverLetter, status, appliedAt

conversations/{id}
  participants[], participantNames{}, participantPhotos{}
  lastMessage, lastMessageAt, lastSenderId

conversations/{id}/messages/{msgId}
  senderId, text, fileUrl, fileName, fileType, createdAt, read
```
