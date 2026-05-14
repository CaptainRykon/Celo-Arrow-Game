// src/lib/firebase.ts

import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getDatabase } from "firebase/database";

let app: any = null;
let db: any = null;
let auth: any = null;
let authReady: Promise<void> | null = null;

// ✅ Function-based init (NOT auto-run)
export function initFirebase() {
  if (typeof window === "undefined") return;

  if (app) return; // already initialized

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  };

  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

  db = getDatabase(app);
  auth = getAuth(app);

  let resolveAuthReady!: () => void;

  authReady = new Promise<void>((resolve) => {
    resolveAuthReady = resolve;
  });

  signInAnonymously(auth).catch(console.error);

  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("✔ Firebase Ready:", user.uid);
      resolveAuthReady();
    }
  });
}

// ✅ getters (safe)
export function getFirebase() {
  return { app, db, auth, authReady };
}