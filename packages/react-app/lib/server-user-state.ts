import "server-only"

import type { Address } from "viem"

import type {
    UniversalProgress,
    UserSnapshot
} from "./types"

import {
    readDb,
    writeDb,
    deleteDb
} from "./firebase-server"

const DEFAULT_UNIVERSAL: UniversalProgress = {
    weeklyChallengeCycleIndex: 0,
    weeklyChallengeEndUnixMilliseconds: 0
}

const FREE_UNLOCK_HINT_REWARD = 5

function normalizeWalletAddress(
    walletAddress: string
) {
    return walletAddress.trim()
}

export function buildDefaultUserSnapshot(
    walletAddress: string,
    universal: UniversalProgress = DEFAULT_UNIVERSAL
): UserSnapshot {
    return {
        walletAddress,
        username: "Player",
        hasPurchasedGame: false,
        hints: 0,
        tutorialCompleted: false,
        classic: {
            level: 1
        },
        challenge: {
            chances: 1,
            lastResetUnixMilliseconds: Date.now(),
            streakCycleIndex: 0,
            streakMask: 0,
            bestTimeSeconds: -1
        },
        universal
    }
}

export function buildStoredUserRecord(
    snapshot: UserSnapshot
) {
    return {
        walletAddress: snapshot.walletAddress,
        username: snapshot.username,
        hasPurchasedGame: snapshot.hasPurchasedGame,
        hints: snapshot.hints,
        tutorialCompleted: snapshot.tutorialCompleted,
        classic: snapshot.classic,
        challenge: snapshot.challenge
    }
}

export function mergeSnapshot(
    walletAddress: string,
    raw: any,
    universal: UniversalProgress
): UserSnapshot {
    const base =
        buildDefaultUserSnapshot(
            walletAddress,
            universal
        )

    return {
        walletAddress,
        username:
            typeof raw?.username === "string" &&
            raw.username.trim()
                ? raw.username.trim()
                : base.username,
        hasPurchasedGame:
            !!raw?.hasPurchasedGame,
        hints:
            Math.max(
                0,
                Number(
                    raw?.hints ??
                    base.hints
                )
            ),
        tutorialCompleted:
            !!raw?.tutorialCompleted,
        classic: {
            level:
                Math.max(
                    1,
                    Number(
                        raw?.classic?.level ??
                        base.classic.level
                    )
                )
        },
        challenge: {
            chances:
                Math.max(
                    0,
                    Number(
                        raw?.challenge?.chances ??
                        base.challenge.chances
                    )
                ),
            lastResetUnixMilliseconds:
                Number(
                    raw?.challenge?.lastResetUnixMilliseconds ??
                    base.challenge.lastResetUnixMilliseconds
                ),
            streakCycleIndex:
                Number(
                    raw?.challenge?.streakCycleIndex ??
                    base.challenge.streakCycleIndex
                ),
            streakMask:
                Math.max(
                    0,
                    Number(
                        raw?.challenge?.streakMask ??
                        base.challenge.streakMask
                    )
                ),
            bestTimeSeconds:
                Number(
                    raw?.challenge?.bestTimeSeconds ??
                    base.challenge.bestTimeSeconds
                )
        },
        universal
    }
}

export async function getUniversalSnapshot() {
    const snapshot =
        await readDb<any>(
            "universal/currentChallenge"
        )

    if (!snapshot) {
        await writeDb(
            "universal/currentChallenge",
            DEFAULT_UNIVERSAL
        )

        return DEFAULT_UNIVERSAL
    }

    return {
        weeklyChallengeCycleIndex:
            Number(
                snapshot?.weeklyChallengeCycleIndex ??
                DEFAULT_UNIVERSAL.weeklyChallengeCycleIndex
            ),
        weeklyChallengeEndUnixMilliseconds:
            Number(
                snapshot?.weeklyChallengeEndUnixMilliseconds ??
                DEFAULT_UNIVERSAL.weeklyChallengeEndUnixMilliseconds
            )
    }
}

export async function getOrCreateUserSnapshot(
    wallet: Address | string
) {
    const normalizedWallet =
        normalizeWalletAddress(
            wallet as string
        )

    const universal =
        await getUniversalSnapshot()

    const rawUser =
        await readDb<any>(
            `users/${normalizedWallet}`
        )

    if (!rawUser) {
        const user =
            buildDefaultUserSnapshot(
                normalizedWallet,
                universal
            )

        await writeDb(
            `users/${normalizedWallet}`,
            buildStoredUserRecord(user)
        )
        await deleteDb(
            `users/${normalizedWallet}/universal`
        )
        return user
    }

    const user =
        mergeSnapshot(
            normalizedWallet,
            rawUser,
            universal
        )

    const hasLegacyFields =
        Object.prototype.hasOwnProperty.call(rawUser, "revives") ||
        Object.prototype.hasOwnProperty.call(rawUser, "lives") ||
        Object.prototype.hasOwnProperty.call(rawUser, "universal")

    if (hasLegacyFields) {
        await writeDb(
            `users/${normalizedWallet}`,
            buildStoredUserRecord(user)
        )
        await deleteDb(
            `users/${normalizedWallet}/universal`
        )
    }

    return user
}

export function sanitizeSnapshot(
    snapshot: UserSnapshot
): UserSnapshot {
    return {
        walletAddress:
            snapshot.walletAddress || "",
        username:
            snapshot.username || "Player",
        hasPurchasedGame:
            !!snapshot.hasPurchasedGame,
        hints:
            Math.max(
                0,
                Number(snapshot.hints || 0)
            ),
        tutorialCompleted:
            !!snapshot.tutorialCompleted,
        classic: {
            level: Math.max(
                1,
                Number(snapshot.classic?.level || 1)
            )
        },
        challenge: {
            chances: Math.max(
                0,
                Number(snapshot.challenge?.chances || 0)
            ),
            lastResetUnixMilliseconds:
                Number(
                    snapshot.challenge?.lastResetUnixMilliseconds ||
                    Date.now()
                ),
            streakCycleIndex:
                Number(
                    snapshot.challenge?.streakCycleIndex || 0
                ),
            streakMask:
                Math.max(
                    0,
                    Number(snapshot.challenge?.streakMask || 0)
                ),
            bestTimeSeconds:
                Number(
                    snapshot.challenge?.bestTimeSeconds || -1
                )
        },
        universal: {
            weeklyChallengeCycleIndex:
                Number(
                    snapshot.universal?.weeklyChallengeCycleIndex || 0
                ),
            weeklyChallengeEndUnixMilliseconds:
                Number(
                    snapshot.universal?.weeklyChallengeEndUnixMilliseconds ||
                    0
                )
        }
    }
}

export async function bootstrapUserSnapshot(
    walletAddress: string
) {
    return await getOrCreateUserSnapshot(
        walletAddress as Address
    )
}

export async function syncUserSnapshot(
    snapshot: UserSnapshot
) {
    const cleanSnapshot =
        sanitizeSnapshot(snapshot)

    const universal =
        await getUniversalSnapshot()

    const mergedSnapshot = {
        ...cleanSnapshot,
        universal
    }

    await writeDb(
        `users/${mergedSnapshot.walletAddress}`,
        buildStoredUserRecord(mergedSnapshot)
    )
    await deleteDb(
        `users/${mergedSnapshot.walletAddress}/universal`
    )

    return mergedSnapshot
}

export async function completeGamePurchase(
    walletAddress: string
) {
    const user =
        await getOrCreateUserSnapshot(
            walletAddress as Address
        )

    const wallet =
        normalizeWalletAddress(
            walletAddress
        )

    const snapshot = {
        ...user,
        hasPurchasedGame: true,
        hints:
            user.hasPurchasedGame
                ? user.hints
                : user.hints + FREE_UNLOCK_HINT_REWARD
    }

    await writeDb(
        `users/${wallet}`,
        buildStoredUserRecord(snapshot)
    )
    await deleteDb(
        `users/${wallet}/universal`
    )

    return {
        success: true,
        snapshot
    }
}

export async function completeHintPurchase(
    walletAddress: string,
    amount: number
) {
    const user =
        await getOrCreateUserSnapshot(
            walletAddress as Address
        )

    const wallet =
        normalizeWalletAddress(
            walletAddress
        )

    const hints =
        user.hints + Math.max(0, amount)

    const snapshot = {
        ...user,
        hints
    }

    await writeDb(
        `users/${wallet}`,
        buildStoredUserRecord(snapshot)
    )
    await deleteDb(
        `users/${wallet}/universal`
    )

    return {
        success: true,
        snapshot
    }
}

export async function completeRevivePurchase(
    walletAddress: string
) {
    const snapshot =
        await getOrCreateUserSnapshot(
            walletAddress as Address
        )

    return {
        success: true,
        snapshot
    }
}
