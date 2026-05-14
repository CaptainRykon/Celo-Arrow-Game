import { ref, get, set, update } from "firebase/database"
import { initFirebase, getFirebase } from "./firebase"

function getMidnight() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
}

function getNextMidnight() {
    const d = new Date()
    d.setHours(24, 0, 0, 0)
    return d.getTime()
}

export async function initUser(wallet: string, username: string) {
    await initFirebase()

    const { db, authReady } = getFirebase()
    await authReady

    console.log("🔥 INIT USER CALLED:", wallet)

    const userRef = ref(db, `users/${wallet}`)
    const snap = await get(userRef)

    if (!snap.exists()) {
        await set(userRef, {
            username,
            chances: 1,
            lastReset: getMidnight()
        })
    }
}

// ✅ GET USER + DAILY RESET
export async function getUser(wallet: string) {
    await initFirebase()

    const { db, authReady } = getFirebase()
    await authReady

    const userRef = ref(db, `users/${wallet}`)
    const snap = await get(userRef)

    if (!snap.exists()) return null

    let data = snap.val()
    const today = getMidnight()

    if (data.lastReset < today) {
        data.chances = 1
        data.lastReset = today

        await update(userRef, {
            chances: 1,
            lastReset: today
        })
    }

    return {
        ...data,
        nextReset: getNextMidnight()
    }
}

// ✅ USE CHANCE
export async function consumeChance(wallet: string) {
    await initFirebase()

    const { db, authReady } = getFirebase()
    await authReady

    const userRef = ref(db, `users/${wallet}`)
    const snap = await get(userRef)

    let data = snap.val()

    if (data.chances <= 0) return false

    await update(userRef, {
        chances: data.chances - 1
    })

    return true
}

export async function updateUsername(wallet: string, username: string) {
    await initFirebase()

    const { db, authReady } = getFirebase()
    await authReady

    const userRef = ref(db, `users/${wallet}`)

    await update(userRef, {
        username: username
    })
}

// ✅ ADD CHANCES
export async function addChances(wallet: string, amount: number) {
    await initFirebase()

    const { db, authReady } = getFirebase()
    await authReady

    const userRef = ref(db, `users/${wallet}`)
    const snap = await get(userRef)

    let data = snap.val()

    await update(userRef, {
        chances: (data.chances || 0) + amount
    })
}