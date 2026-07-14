# Williams Course Planner — accounts, enrollment tracking, and notes

A static, no-build-step website: login/signup, a course planner, a "mark enrolled" flow, and a
per-course notes page, backed by Firebase (Auth + Firestore). Everything runs client-side —
GitHub Pages (or any static host) can serve it as-is once you've created your own Firebase
project and filled in `shared/firebase-config.js`.

**&copy; 2026 Yule Kwon. All rights reserved.** See [`LICENSE`](./LICENSE) — this repository being
publicly viewable does not grant permission to copy, redistribute, or reuse it.

## Files

- `index.html` — login / sign-up landing page
- `planner.html` — the course planner (quiz + plan generator), now behind login, with a **Mark
  Enrolled** button on every suggested course
- `notes.html` — lists your enrolled courses with an autosaving notes box per course
- `admin.html` — owner-only: a tally of what courses/majors people are actually enrolling in,
  across all users
- `shared/course-data.js` — the full course catalog (`DEPTS`, `LANGUAGES`, `DEPT_ORDER`)
- `shared/styles.css` — shared styling
- `shared/firebase-config.js` — **you fill this in** with your Firebase project's config
- `shared/auth.js` — signup/login/logout, the auth guard, and the shared nav bar
- `firestore.rules` — Firestore security rules (deploy these to your project)

The original single-file version (`/Users/yule/williams-course-planner.html`) is left untouched
as a backup/reference.

## 1. Create a Firebase project (~10 minutes)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Add
   project**. Name it whatever you like. You can decline Google Analytics for this project — it's
   not needed.
2. In the left sidebar, go to **Build -> Authentication -> Get started**. Under **Sign-in
   method**, enable the **Email/Password** provider (leave "Email link" off). This is what backs
   the username/password login — usernames are translated into a fake, never-emailed address
   behind the scenes (see "Known limitations" below).
3. In the left sidebar, go to **Build -> Firestore Database -> Create database**. Choose
   **production mode** (not test mode — test mode's default rules allow anyone to read/write
   everything, and we're deploying our own rules anyway) and any region close to you.
4. Go to **Project settings** (gear icon) -> **General**, scroll to **Your apps**, click the
   `</>` (web) icon, register an app (any nickname), and skip the "Firebase Hosting" offer — you
   don't need it, GitHub Pages is your host. Copy the `firebaseConfig` object it shows you.
5. Paste those values into `shared/firebase-config.js`, replacing the `REPLACE_WITH_...`
   placeholders. This file is safe to commit and publish — it's a public client identifier, not a
   secret. Your data is protected by the security rules below, not by hiding this file.

## 2. Deploy the security rules

The rules in `firestore.rules` are what actually protect user data (every user can only read/write
their own documents; the shape and size of writes are validated too). If you skip this and leave
the default rules from project creation, either everything is world-writable (test mode) or
nothing works at all (locked mode).

Easiest path — paste directly in the console:
1. Firebase Console -> **Firestore Database -> Rules** tab.
2. Replace the contents with everything in `firestore.rules` from this repo.
3. Click **Publish**.

(If you prefer the CLI: `npm i -g firebase-tools`, `firebase login`, `firebase init firestore`
pointing at this project, then `firebase deploy --only firestore:rules`.)

## 3. Set yourself as the admin (do this after your first real signup)

`admin.html` only works for one hardcoded Firebase Auth UID — yours. Once Firestore rules are
deployed:

1. Open `index.html` locally or on your published site and sign up with the account you want to
   use as the owner/admin account.
2. In the Firebase Console, go to **Authentication -> Users** and copy the **User UID** next to
   that account.
3. Paste it into `OWNER_UID` in `shared/firebase-config.js`.
4. Also replace `OWNER_UID_HERE` in `firestore.rules` with the *same* UID, and re-publish the
   rules (step 2 above). Both places need to match, or `admin.html`'s queries will be denied even
   for you — the client-side check in `admin.html` is just a UX nicety; the rule is what actually
   enforces it.

If `admin.html` shows "no data yet" on first load, you may also need to let Firestore create a
composite/collection-group index for the `enrollments` collection group — Firestore will print a
direct "create this index" link in the browser dev console the first time the query runs; click
it, wait a minute or two for the index to build, then reload.

## 4. Run it locally / deploy to GitHub Pages

This is a static site — no build step. To test locally, serve the folder with any static file
server (opening `index.html` directly via `file://` will NOT work — ES modules require an actual
HTTP origin), e.g.:

```
cd williams-course-planner
python3 -m http.server 8000
# visit http://localhost:8000
```

To publish: push this folder to a GitHub repo, then in the repo's **Settings -> Pages**, set the
source to the branch/folder containing these files. `index.html` at the root becomes your site's
homepage automatically.

## Data model

```
usernames/{username}                       { uid }
users/{uid}                                 { username, createdAt }
users/{uid}/enrollments/{courseCode}        { code, deptKey, deptLabel, term, level,
                                               majorAtEnrollment, enrolledAt, notes, notesUpdatedAt }
```

## Getting analytics beyond admin.html

`admin.html` covers "what courses/majors are people enrolling in." For anything deeper (export to
a spreadsheet, run one-off queries), the Firebase Admin SDK bypasses security rules entirely using
a service account key — this is meant for trusted offline scripts, never for client-side code:

```js
// scripts/export.js -- run with `node scripts/export.js`, not shipped to the website
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(require("./serviceAccountKey.json")) });
const db = admin.firestore();
db.collectionGroup("enrollments").get().then(snap => {
  snap.forEach(doc => console.log(doc.ref.path, doc.data()));
});
```

Download the service account key from **Project settings -> Service accounts -> Generate new
private key** — keep this file out of git (it's a real secret, unlike `firebase-config.js`).

## Known limitations (v1)

- **No password reset.** Usernames are mapped to a fake email address
  (`username@users.williamsplanner.local`) so people can log in with a plain username instead of a
  real email — but that means there's no real inbox for Firebase to send a reset link to. If
  someone forgets their password today, the fix is a manual one: Firebase Console ->
  Authentication -> Users -> find them -> **Reset password**, which lets you set a new password
  directly, or delete the account and have them sign up again.
- **Usernames can't be changed** once set (the `users/{uid}` doc is create-once by rule).
- **Enrollment doc fields other than notes are locked in at signup time** — if you swap to a
  different course in the planner, that's a new enrollment (delete the old one, mark the new one),
  not an edit.
