# JobMan — Launch Checklist

> Before running this checklist, deploy the repository versions of `firestore.rules` and `storage.rules` with `firebase deploy --only firestore:rules,storage`. Do not replace them with the legacy example below; the checked-in Firestore rules also protect imported job listings.

## Task 1 — Create Firestore Indexes (~5 min)

Firebase Console → your `jobman` project → **Firestore Database** → **Indexes** tab → **Composite** → **Create index**. Create these 4 (Query scope: Collection):

| # | Collection ID | Fields (in order) |
|---|---|---|
| 1 | `profiles` | `type` Ascending, `rating` Descending |
| 2 | `profiles` | `type` Ascending, `category` Ascending, `rating` Descending |
| 3 | `jobs` | `status` Ascending, `createdAt` Descending |
| 4 | `conversations` | `participants` **Array contains**, `lastMessageAt` Descending |

Each shows "Building…" for 1–2 minutes, then "Enabled".

Shortcut: if a page in the app shows a red console error with a
`https://console.firebase.google.com/...` link, clicking that link
pre-fills the exact index — just press Create.

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
10. Sign out, sign in with email A → Messages → reply (try the ✨ suggestions)
11. Jobs tab → open the employer's job → **✨ Write with AI** cover letter → Apply

If every step works, your marketplace is fully functional.

## Task 3 — Run the Mobile App (~10 min)

1. On your phone: install **Expo Go** (App Store / Play Store)
2. In Terminal:
   ```bash
   yarn mobile
   ```
3. Scan the QR code (iPhone: Camera app; Android: inside Expo Go)
4. Phone and Mac must be on the same Wi-Fi

**Google sign-in on mobile** (email sign-in works without this):
1. https://console.cloud.google.com → select the `jobman` project
2. **APIs & Services → Credentials** → under "OAuth 2.0 Client IDs" copy the **Web client** ID
3. Paste it into `packages/shared/src/firebase/config.ts` as `GOOGLE_WEB_CLIENT_ID`

## Task 4 — Deploy the Website (Vercel, free)

1. Create accounts: github.com and vercel.com (sign in to Vercel *with* GitHub)
2. Push the code:
   ```bash
   yarn validate
   ```
   (`.env.local` is gitignored — your API key will NOT be uploaded)
3. Vercel → **Add New… → Project** → Import `jobman`
4. Set **Root Directory** to `apps/web`
5. **Environment Variables**: add `ANTHROPIC_API_KEY` if using AI features. Add `FIREBASE_SERVICE_ACCOUNT_KEY` and `INGESTION_SECRET` before enabling job-board ingestion.
6. Deploy → you get `jobman-xyz.vercel.app`
7. **IMPORTANT:** Firebase Console → Authentication → Settings →
   **Authorized domains** → Add your vercel.app domain (sign-in breaks without this)

**Custom domain:** buy at namecheap.com (e.g. getjobman.com, ~$10/yr) →
Vercel project → Settings → Domains → Add → follow the DNS instructions →
also add the domain to Firebase Authorized domains.

## Task 5 — Security Rules (BEFORE real users)

Deploy the version-controlled rules instead of copying a separate snippet:

```bash
firebase deploy --only firestore:rules,storage
```

The current files are `firestore.rules` and `storage.rules`. They protect imported jobs from browser writes while allowing the server-side connector to write through Firebase Admin.

### Legacy console reference

The snippet below is retained only as an explanatory reference. Do not paste it over the repository rules.

Firebase Console → Firestore Database → **Rules** tab → replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
    match /profiles/{uid} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
    match /jobs/{id} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      allow delete: if request.auth != null && request.auth.uid == resource.data.postedBy;
    }
    match /applications/{id} {
      allow read, create: if request.auth != null;
    }
    match /conversations/{id} {
      allow create: if request.auth != null;
      allow read, update: if request.auth != null
        && request.auth.uid in resource.data.participants;
      match /messages/{msgId} {
        allow read, create: if request.auth != null;
      }
    }
  }
}
```

Then **Storage → Rules** → replace with:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Click **Publish** on both.
