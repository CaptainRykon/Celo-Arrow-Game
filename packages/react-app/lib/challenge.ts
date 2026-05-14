import {
    ref,
    get,
    set,
    update
} from "firebase/database"

import { db } from "./firebase"

const DEFAULT_CHANCES = 1
const CHALLENGE_COOLDOWN_HOURS = 24

function getNow() {
    return Date.now()
}

function getNextResetTime() {
    const now = new Date()

    now.setHours(24, 0, 0, 0)

    return now.getTime()
}

export async function getChallengeProgress(
    wallet: string
) {
    const snapshot = await get(
        ref(db, `users/${wallet}/challenge`)
    )

    if (!snapshot.exists()) {
        const defaultData = {
            chances: DEFAULT_CHANCES,
            lastResetUnixMilliseconds: getNow(),
            streakCycleIndex: 0,
            streakMask: 0,
            bestTimeSeconds: -1
        }

        await set(
            ref(db, `users/${wallet}/challenge`),
            defaultData
        )

        return defaultData
    }

    const data = snapshot.val()

    const now = getNow()

    const diff =
        now - (data.lastResetUnixMilliseconds || 0)

    const cooldown =
        CHALLENGE_COOLDOWN_HOURS *
        60 *
        60 *
        1000

    // daily reset
    if (diff >= cooldown) {
        data.chances = DEFAULT_CHANCES
        data.lastResetUnixMilliseconds = now

        await update(
            ref(db, `users/${wallet}/challenge`),
            {
                chances: data.chances,
                lastResetUnixMilliseconds:
                    data.lastResetUnixMilliseconds
            }
        )
    }

    return data
}

export async function consumeChallengeChance(
    wallet: string
) {
    const data = await getChallengeProgress(wallet)

    if (data.chances <= 0) {
        return {
            success: false,
            error: "No chances left"
        }
    }

    data.chances -= 1

    await update(
        ref(db, `users/${wallet}/challenge`),
        {
            chances: data.chances
        }
    )

    return {
        success: true,
        data
    }
}

export async function addChallengeChances(
    wallet: string,
    amount: number
) {
    const data = await getChallengeProgress(wallet)

    data.chances += amount

    await update(
        ref(db, `users/${wallet}/challenge`),
        {
            chances: data.chances
        }
    )

    return {
        success: true,
        data
    }
}

export async function updateBestChallengeTime(
    wallet: string,
    seconds: number
) {
    const data = await getChallengeProgress(wallet)

    if (
        data.bestTimeSeconds < 0 ||
        seconds < data.bestTimeSeconds
    ) {
        data.bestTimeSeconds = seconds

        await update(
            ref(db, `users/${wallet}/challenge`),
            {
                bestTimeSeconds: seconds
            }
        )
    }

    return data
}

export async function updateChallengeStreak(
    wallet: string,
    cycleIndex: number,
    dayIndex: number
) {
    const data = await getChallengeProgress(wallet)

    if (data.streakCycleIndex !== cycleIndex) {
        data.streakCycleIndex = cycleIndex
        data.streakMask = 0
    }

    data.streakMask =
        data.streakMask |
        (1 << dayIndex)

    await update(
        ref(db, `users/${wallet}/challenge`),
        {
            streakCycleIndex:
                data.streakCycleIndex,

            streakMask:
                data.streakMask
        }
    )

    return data
}

export function getChallengeResetTime() {
    return getNextResetTime()
}