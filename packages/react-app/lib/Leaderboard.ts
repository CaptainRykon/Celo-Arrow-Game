import "server-only"

import {
    patchDb,
    readDb
} from "./firebase-server"

const CURRENT_CHALLENGE_PATH =
    "universal/currentChallenge"
const MAX_LEADERBOARD_ENTRIES = 25

export interface LeaderboardEntry {
    rank: number
    playerName: string
    walletAddress: string
    completionSeconds: number
    updatedAt: number
}

interface StoredLeaderboardEntry {
    playerName: string
    walletAddress: string
    completionSeconds: number
    updatedAt: number
}

function normalizeWalletAddress(
    walletAddress: string
) {
    return (
        walletAddress || ""
    ).trim()
}

function normalizePatternName(
    patternName: string
) {
    return (
        patternName || "Unknown"
    ).trim() || "Unknown"
}

function clampLimit(
    limit: number
) {
    if (!Number.isFinite(limit))
        return MAX_LEADERBOARD_ENTRIES

    return Math.min(
        MAX_LEADERBOARD_ENTRIES,
        Math.max(1, Math.floor(limit))
    )
}

function isMatchingCycle(
    state: any,
    cycleIndex: number,
    patternName: string
) {
    return (
        Number(
            state?.leaderboardCycleIndex ?? -1
        ) === cycleIndex &&
        normalizePatternName(
            String(
                state?.leaderboardPatternName ||
                ""
            )
        ) === patternName
    )
}

function sortEntries(
    entries: StoredLeaderboardEntry[]
) {
    entries.sort(
        (left, right) => {
            const timeDelta =
                left.completionSeconds -
                right.completionSeconds

            if (Math.abs(timeDelta) > 0.0001)
                return timeDelta

            const updatedAtDelta =
                left.updatedAt -
                right.updatedAt

            if (updatedAtDelta !== 0)
                return updatedAtDelta

            return left.walletAddress.localeCompare(
                right.walletAddress
            )
        }
    )

    return entries
}

function mapToSortedEntries(
    raw:
        | Record<
              string,
              StoredLeaderboardEntry
          >
        | null
        | undefined
) {
    const entries = Object.values(
        raw || {}
    ).filter(
        entry =>
            !!entry &&
            !!normalizeWalletAddress(
                entry.walletAddress
            ) &&
            Number.isFinite(
                entry.completionSeconds
            ) &&
            entry.completionSeconds > 0
    )

    sortEntries(entries)

    return entries.map(
        (entry, index) => ({
            rank: index + 1,
            playerName:
                typeof entry.playerName ===
                    "string" &&
                entry.playerName.trim()
                    ? entry.playerName.trim()
                    : "Player",
            walletAddress:
                normalizeWalletAddress(
                    entry.walletAddress
                ),
            completionSeconds:
                Number(
                    entry.completionSeconds
                ),
            updatedAt: Number(
                entry.updatedAt || 0
            )
        })
    )
}

function toStoredLeaderboard(
    entries: LeaderboardEntry[]
) {
    const leaderboard: Record<
        string,
        StoredLeaderboardEntry
    > = {}

    for (const entry of entries) {
        const walletAddress =
            normalizeWalletAddress(
                entry.walletAddress
            )

        if (!walletAddress)
            continue

        leaderboard[walletAddress] = {
            playerName:
                typeof entry.playerName ===
                    "string" &&
                entry.playerName.trim()
                    ? entry.playerName.trim()
                    : "Player",
            walletAddress,
            completionSeconds:
                Number(
                    entry.completionSeconds
                ),
            updatedAt: Number(
                entry.updatedAt || 0
            )
        }
    }

    return leaderboard
}

export async function submitChallengeScore(
    walletAddress: string,
    playerName: string,
    cycleIndex: number,
    patternName: string,
    completionSeconds: number
) {
    const normalizedWallet =
        normalizeWalletAddress(
            walletAddress
        )
    const normalizedPatternName =
        normalizePatternName(
            patternName
        )
    const safePlayerName =
        typeof playerName === "string" &&
        playerName.trim()
            ? playerName.trim()
            : "Player"
    const safeCompletionSeconds =
        Number(completionSeconds)

    if (!normalizedWallet) {
        throw new Error(
            "Wallet missing"
        )
    }

    if (
        !Number.isFinite(
            safeCompletionSeconds
        ) ||
        safeCompletionSeconds <= 0
    ) {
        throw new Error(
            "Completion time is invalid"
        )
    }

    const state = await readDb<any>(
        CURRENT_CHALLENGE_PATH
    )

    const currentEntries =
        isMatchingCycle(
            state,
            cycleIndex,
            normalizedPatternName
        )
            ? mapToSortedEntries(
                  state?.leaderboard
              )
            : []

    const existingEntry =
        currentEntries.find(
            entry =>
                entry.walletAddress.toLowerCase() ===
                normalizedWallet.toLowerCase()
        )

    if (
        existingEntry &&
        existingEntry.completionSeconds <=
            safeCompletionSeconds
    ) {
        return {
            success: true,
            improved: false,
            entries: currentEntries,
            playerRank:
                existingEntry.rank <=
                MAX_LEADERBOARD_ENTRIES
                    ? existingEntry.rank
                    : -1
        }
    }

    const nextEntries =
        currentEntries.filter(
            entry =>
                entry.walletAddress.toLowerCase() !==
                normalizedWallet.toLowerCase()
        )

    nextEntries.push({
        rank: 0,
        playerName: safePlayerName,
        walletAddress: normalizedWallet,
        completionSeconds:
            safeCompletionSeconds,
        updatedAt: Date.now()
    })

    const trimmedEntries =
        mapToSortedEntries(
            toStoredLeaderboard(
                nextEntries
            )
        ).slice(
            0,
            MAX_LEADERBOARD_ENTRIES
        )

    await patchDb(
        CURRENT_CHALLENGE_PATH,
        {
            leaderboardCycleIndex:
                cycleIndex,
            leaderboardPatternName:
                normalizedPatternName,
            leaderboard:
                toStoredLeaderboard(
                    trimmedEntries
                )
        }
    )

    const playerRank =
        trimmedEntries.findIndex(
            entry =>
                entry.walletAddress.toLowerCase() ===
                normalizedWallet.toLowerCase()
        ) + 1

    return {
        success: true,
        improved: true,
        entries: trimmedEntries,
        playerRank:
            playerRank > 0
                ? playerRank
                : -1
    }
}

export async function getChallengeLeaderboard(
    cycleIndex: number,
    patternName: string,
    limit: number =
        MAX_LEADERBOARD_ENTRIES,
    playerWallet?: string
) {
    const normalizedPatternName =
        normalizePatternName(
            patternName
        )
    const safeLimit = clampLimit(
        limit
    )
    const state = await readDb<any>(
        CURRENT_CHALLENGE_PATH
    )

    if (
        !state ||
        !isMatchingCycle(
            state,
            cycleIndex,
            normalizedPatternName
        )
    ) {
        return {
            entries: [],
            playerRank: -1
        }
    }

    const entries = mapToSortedEntries(
        state?.leaderboard
    ).slice(0, safeLimit)
    const normalizedPlayerWallet =
        normalizeWalletAddress(
            playerWallet || ""
        ).toLowerCase()

    const playerRank =
        normalizedPlayerWallet
            ? entries.findIndex(
                  entry =>
                      entry.walletAddress.toLowerCase() ===
                      normalizedPlayerWallet
              ) + 1
            : -1

    return {
        entries,
        playerRank:
            playerRank > 0
                ? playerRank
                : -1
    }
}
