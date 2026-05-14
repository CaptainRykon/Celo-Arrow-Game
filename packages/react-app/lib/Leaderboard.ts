import {
    ref,
    get,
    set,
    query,
    orderByChild,
    limitToFirst
} from "firebase/database"

import { db } from "./firebase"

export interface LeaderboardEntry {
    rank: number
    playerName: string
    walletAddress: string
    completionSeconds: number
    updatedAt: number
}

function getLeaderboardPath(
    cycleIndex: number,
    patternName: string
) {
    return `leaderboards/${cycleIndex}/${patternName}`
}

export async function submitChallengeScore(
    walletAddress: string,
    playerName: string,
    cycleIndex: number,
    patternName: string,
    completionSeconds: number
) {
    const playerRef = ref(
        db,
        `${getLeaderboardPath(
            cycleIndex,
            patternName
        )}/${walletAddress}`
    )

    const existingSnapshot = await get(playerRef)

    // only replace if better score
    if (existingSnapshot.exists()) {
        const existing = existingSnapshot.val()

        if (
            existing.completionSeconds <=
            completionSeconds
        ) {
            return {
                success: true,
                improved: false
            }
        }
    }

    const data = {
        playerName,
        walletAddress,
        completionSeconds,
        updatedAt: Date.now()
    }

    await set(playerRef, data)

    return {
        success: true,
        improved: true
    }
}

export async function getChallengeLeaderboard(
    cycleIndex: number,
    patternName: string,
    limit: number = 10,
    playerWallet?: string
) {
    const leaderboardRef = query(
        ref(
            db,
            getLeaderboardPath(
                cycleIndex,
                patternName
            )
        ),
        orderByChild("completionSeconds"),
        limitToFirst(limit)
    )

    const snapshot = await get(leaderboardRef)

    if (!snapshot.exists()) {
        return {
            entries: [],
            playerRank: -1
        }
    }

    const raw = snapshot.val()

    const entries: LeaderboardEntry[] =
        Object.values(raw)
            .sort(
                (a: any, b: any) =>
                    a.completionSeconds -
                    b.completionSeconds
            )
            .map((entry: any, index) => ({
                rank: index + 1,
                playerName:
                    entry.playerName || "Unknown",
                walletAddress:
                    entry.walletAddress || "",
                completionSeconds:
                    entry.completionSeconds || 0,
                updatedAt:
                    entry.updatedAt || 0
            }))

    let playerRank = -1

    if (playerWallet) {
        const allSnapshot = await get(
            ref(
                db,
                getLeaderboardPath(
                    cycleIndex,
                    patternName
                )
            )
        )

        if (allSnapshot.exists()) {
            const allEntries: any[] =
                Object.values(allSnapshot.val())

            allEntries.sort(
                (a: any, b: any) =>
                    a.completionSeconds -
                    b.completionSeconds
            )

            const index = allEntries.findIndex(
                (entry: any) =>
                    entry.walletAddress ===
                    playerWallet
            )

            if (index >= 0) {
                playerRank = index + 1
            }
        }
    }

    return {
        entries,
        playerRank
    }
}