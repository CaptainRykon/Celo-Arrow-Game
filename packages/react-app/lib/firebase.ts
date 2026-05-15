import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getDatabase, type Database } from "firebase/database"

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
}

let cachedApp: FirebaseApp | undefined
let cachedDb: Database | undefined

function getFirebaseApp(): FirebaseApp {
    if (cachedApp) {
        return cachedApp
    }

    if (getApps().length > 0) {
        cachedApp = getApps()[0]
        return cachedApp
    }

    cachedApp = initializeApp(firebaseConfig)
    return cachedApp
}

export function getDb(): Database {
    if (!cachedDb) {
        cachedDb = getDatabase(getFirebaseApp())
    }

    return cachedDb
}