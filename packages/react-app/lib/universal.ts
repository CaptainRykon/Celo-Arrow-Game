import { ref, get, set } from "firebase/database"
import { db } from "./firebase"

const UNIVERSAL_PATH = "universal/currentChallenge"

export async function getUniversalData() {
    const snapshot = await get(ref(db, UNIVERSAL_PATH))

    if (!snapshot.exists()) {
        return null
    }

    return snapshot.val()
}

export async function setUniversalData(data: any) {
    await set(ref(db, UNIVERSAL_PATH), data)
}