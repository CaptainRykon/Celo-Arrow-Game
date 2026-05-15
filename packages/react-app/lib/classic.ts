import { ref, get, set } from "firebase/database"
import { getDb } from "./firebase"

export async function getClassicProgress(wallet: string) {
    const snapshot = await get(
        ref(getDb(), `users/${wallet}/classic`)
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
        ref(getDb(), `users/${wallet}/classic`),
        data
    )
}