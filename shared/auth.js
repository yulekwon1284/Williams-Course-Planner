/* ============ SHARED AUTH MODULE ============
   ES module — must be loaded with <script type="module" src="shared/auth.js"> or imported from
   another module script. Wraps Firebase Auth + a small Firestore username reservation so users
   log in with a plain username instead of an email address.

   Firebase SDK version is pinned (not @latest) since this project has no build step to catch a
   breaking SDK update — bump it deliberately when you want to upgrade. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { FIREBASE_CONFIG, USERNAME_EMAIL_DOMAIN, OWNER_UID } from "./firebase-config.js?v=10";

const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Explicit even though it's the SDK default, so "stays logged in across days" is visible in code.
setPersistence(auth, browserLocalPersistence).catch((e) => console.error("setPersistence failed", e));

export function normalizeUsername(raw) {
  return (raw || "").trim().toLowerCase();
}
export function isValidUsername(username) {
  return /^[a-z0-9_]{3,20}$/.test(username);
}
function usernameToEmail(username) {
  return `${username}@${USERNAME_EMAIL_DOMAIN}`;
}

export async function signUp(rawUsername, password) {
  const username = normalizeUsername(rawUsername);
  if (!isValidUsername(username)) {
    throw new Error("Usernames must be 3-20 characters: lowercase letters, numbers, and underscores only.");
  }
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
  const email = usernameToEmail(username);

  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, email, password);
  } catch (e) {
    if (e.code === "auth/email-already-in-use") throw new Error("That username is already taken.");
    if (e.code === "auth/weak-password") throw new Error("Password is too weak — use at least 6 characters.");
    throw new Error("Could not create account (" + (e.code || e.message) + ").");
  }

  // Firestore's create-vs-update rule semantics make this an atomic "reserve the name or fail"
  // write, independent of Firebase Auth's own duplicate-account error behavior (see README).
  try {
    await setDoc(doc(db, "usernames", username), { uid: cred.user.uid });
  } catch (e) {
    await deleteUser(cred.user).catch(() => {});
    throw new Error("That username is already taken.");
  }

  await setDoc(doc(db, "users", cred.user.uid), { username, createdAt: serverTimestamp() });
  return cred.user;
}

export async function logIn(rawUsername, password) {
  const username = normalizeUsername(rawUsername);
  const email = usernameToEmail(username);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch (e) {
    throw new Error("Incorrect username or password.");
  }
}

export async function logOut() {
  await signOut(auth);
  window.location.href = "index.html";
}

/* One-shot auth guard for protected pages: unsubscribes itself on the first auth event so it
   never re-fires the redirect/reveal logic on later events (token refresh, other-tab sign-out).
   Callers should render their page inside a <body class="auth-pending"> wrapper (see styles.css)
   so nothing is visible until this resolves. */
export function requireLogin(onUser) {
  const unsub = onAuthStateChanged(auth, (user) => {
    unsub();
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    document.body.classList.remove("auth-pending");
    onUser(user);
  });
}

/* Used only by index.html: bounce an already-logged-in visitor straight to the planner instead
   of showing them the login form again. */
export function redirectIfLoggedIn(destination) {
  const unsub = onAuthStateChanged(auth, (user) => {
    unsub();
    if (user) window.location.href = destination || "planner.html";
  });
}

export function usernameFromUser(user) {
  return (user && user.email) ? user.email.split("@")[0] : "";
}

/* Shared top nav for the three logged-in pages. Inserted right after the director-credit banner
   (or as the first element in <body> on a page that doesn't have one), so the credit banner stays
   the visually topmost element. */
export function mountNav(activePage, user) {
  const nav = document.createElement("div");
  nav.className = "site-nav";
  const isOwner = user && OWNER_UID && user.uid === OWNER_UID && !OWNER_UID.startsWith("REPLACE_");
  nav.innerHTML = `
    <div class="nav-links">
      <a href="planner.html" class="${activePage === "planner" ? "active-link" : ""}">Planner</a>
      <a href="my-courses.html" class="${activePage === "mycourses" ? "active-link" : ""}">My Courses</a>
      <a href="notes.html" class="${activePage === "notes" ? "active-link" : ""}">My Notes</a>
      ${isOwner ? `<a href="admin.html" class="${activePage === "admin" ? "active-link" : ""}">Admin</a>` : ""}
    </div>
    <div class="nav-user">
      <span>${usernameFromUser(user)}</span>
      <button class="logout-btn" id="nav-logout-btn" type="button">Log out</button>
    </div>`;
  const creditEl = document.querySelector(".director-credit");
  if (creditEl) {
    creditEl.insertAdjacentElement("afterend", nav);
  } else {
    document.body.insertBefore(nav, document.body.firstChild);
  }

  // Pages that have unsaved/in-flight work (currently just planner.html) define
  // window.__beforeNavigateAway; this waits for it before actually leaving, so a save that's
  // still in flight when the user clicks away gets a chance to finish instead of being
  // abandoned mid-request. Pages that don't define it navigate immediately, unaffected.
  async function flushThenGo(navigate) {
    if (typeof window.__beforeNavigateAway === "function") {
      try { await window.__beforeNavigateAway(); } catch (e) { /* already logged by the page */ }
    }
    navigate();
  }

  nav.querySelectorAll(".nav-links a").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const href = link.getAttribute("href");
      flushThenGo(() => { window.location.href = href; });
    });
  });

  document.getElementById("nav-logout-btn").addEventListener("click", () => {
    flushThenGo(() => { logOut(); });
  });
}
