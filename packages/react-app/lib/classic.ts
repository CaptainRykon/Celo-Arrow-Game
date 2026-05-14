import { ref, get, set } from "firebase/database"
import { db } from "./firebase"

export async function getClassicProgress(wallet: string) {
    const snapshot = await get(
        ref(db, `users/${wallet}/classic`)
    )

    if (!snapshot.exists()) {
        return {
            level: 1
        }
    }

    return snapshot.val()
}

export async function saveClassicProgress(
    wallet: string,
    data: any
) {
    await set(
        ref(db, `users/${wallet}/classic`),
        data
    )
}