// src/lib/firebase.ts

import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getDatabase } from "firebase/database";

let app: any = null;
let db: any = null;
let auth: any = null;
let authReady: Promise<void> | null = null;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBvv2vMLgacfTYA-vjO9-o4NdVuMO64N3s",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "sanddrop-32496.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "sanddrop-32496",
  databaseURL:
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
    "https://sanddrop-32496-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "sanddrop-32496.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "220945597047",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:220945597047:web:1ea931fb68294dc31ffc72",
};

// Function-based init (NOT auto-run)
export function initFirebase() {
  if (typeof window === "undefined") return;

  if (app) return; // already initialized

  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

  db = getDatabase(app, firebaseConfig.databaseURL);
  auth = getAuth(app);

  let resolveAuthReady!: () => void;

  authReady = new Promise<void>((resolve) => {
    resolveAuthReady = resolve;
  });

  signInAnonymously(auth).catch((error) => {
    console.error("Firebase anonymous auth failed:", error);
    resolveAuthReady();
  });

  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("Firebase Ready:", user.uid);
      resolveAuthReady();
    }
  });
}

// getters (safe)
export function getFirebase() {
  return { app, db, auth, authReady };
}
