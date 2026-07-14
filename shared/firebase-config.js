/* ============ FIREBASE PROJECT CONFIG — FILL THIS IN ============
   Create a free Firebase project (see README.md "Firebase setup" section), then copy the config
   object shown in Project Settings -> General -> Your apps -> SDK setup and configuration, and
   paste the real values in below. This object is meant to be public/embedded in client code —
   it is not a secret. Access is controlled by firestore.rules and (optionally) API key
   restrictions in the Google Cloud console, not by hiding this file. */
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD8bUULpZqSLQXF-xH87WylrXMySf7IyTg",
  authDomain: "williams-course-planner.firebaseapp.com",
  projectId: "williams-course-planner",
  storageBucket: "williams-course-planner.firebasestorage.app",
  messagingSenderId: "978571026242",
  appId: "1:978571026242:web:f20b99c3cf65a82236f2db"
};

/* Fake email domain used to let Firebase Auth's email/password provider work with plain
   usernames. Never resolves to a real inbox — see README "No password reset" limitation. */
export const USERNAME_EMAIL_DOMAIN = "users.williamsplanner.local";

/* Set this to your own Firebase Auth UID (Console -> Authentication -> Users, after your first
   real signup) to unlock admin.html for your account. Must match OWNER_UID_HERE in
   firestore.rules exactly, or the admin page's Firestore reads will be denied. */
export const OWNER_UID = "Cb5I2d01OxN6a2NM6Z3Wp57AsS13";
