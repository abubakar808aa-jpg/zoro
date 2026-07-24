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

## Step 6 — Paste Config into the Project

Open `packages/shared/src/firebase/config.ts` and replace the placeholder values:

```typescript
export const firebaseConfig = {
  apiKey: "PASTE_HERE",
  authDomain: "PASTE_HERE",
  projectId: "PASTE_HERE",
  storageBucket: "PASTE_HERE",
  messagingSenderId: "PASTE_HERE",
  appId: "PASTE_HERE",
};
```

---

## Step 7 — Google OAuth Client ID (for Mobile)

1. Go to https://console.cloud.google.com
2. Select your Firebase project
3. Navigate to **APIs & Services** → **Credentials**
4. Find the **OAuth 2.0 Client ID** for type **Web application**
5. Copy the Client ID

Open `packages/shared/src/firebase/config.ts` and paste it:

```typescript
export const GOOGLE_WEB_CLIENT_ID = "PASTE_YOUR_CLIENT_ID_HERE";
```

---

## Step 8 — Firestore Indexes

Run these composite index creations in the Firebase console
(**Firestore → Indexes → Composite → Add**):

| Collection | Fields | Order |
|---|---|---|
| `profiles` | `type` ASC, `rating` DESC | |
| `profiles` | `type` ASC, `category` ASC, `rating` DESC | |
| `jobs` | `status` ASC, `createdAt` DESC | |
| `conversations` | `participants` ARRAY, `lastMessageAt` DESC | |

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
