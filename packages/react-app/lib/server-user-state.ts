import "server-only"

import type {
    Address
} from "viem"

import type {
    UniversalProgress,
    UserSnapshot
} from "./types"

import {
    readDb,
    writeDb,
    patchDb,
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
        revives: 3,
        lives: 3,
        hints: 0,
        tutorialCompleted: false,
        classic: {
            level: 1
        },
        challenge: {
            chances: 1,
            lastResetUnixMilliseconds:
                Date.now(),
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
        walletAddress:
            snapshot.walletAddress,
        username:
            snapshot.username,
        hasPurchasedGame:
            snapshot.hasPurchasedGame,
        revives:
            snapshot.revives,
        lives:
            snapshot.revives,
        hints:
            snapshot.hints,
        tutorialCompleted:
            snapshot.tutorialCompleted,
        classic:
            snapshot.classic,
        challenge:
            snapshot.challenge
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

    const revives =
        Math.max(
            0,
            Number(
                raw?.revives ??
                raw?.lives ??
                base.revives
            )
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
        revives,
        lives: revives,
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

    await writeDb(
        `users/${normalizedWallet}`,
        buildStoredUserRecord(user)
    )
    await deleteDb(
        `users/${normalizedWallet}/universal`
    )

    return user
}

export function sanitizeSnapshot(
    snapshot: UserSnapshot
): UserSnapshot {
    const revives =
        Math.max(
            0,
            snapshot.revives ??
            snapshot.lives ??
            0
        )

    return {
        walletAddress:
            snapshot.walletAddress || "",
        username:
            snapshot.username || "Guest",
        hasPurchasedGame:
            !!snapshot.hasPurchasedGame,
        revives,
        lives: revives,
        hints:
            Math.max(
                0,
                snapshot.hints || 0
            ),
        tutorialCompleted:
            !!snapshot.tutorialCompleted,
        classic: {
            level: Math.max(
                1,
                snapshot.classic?.level || 1
            )
        },
        challenge: {
            chances: Math.max(
                0,
                snapshot.challenge
                    ?.chances || 0
            ),
            lastResetUnixMilliseconds:
                snapshot.challenge
                    ?.lastResetUnixMilliseconds ||
                Date.now(),
            streakCycleIndex:
                snapshot.challenge
                    ?.streakCycleIndex || 0,
            streakMask:
                snapshot.challenge
                    ?.streakMask || 0,
            bestTimeSeconds:
                snapshot.challenge
                    ?.bestTimeSeconds || -1
        },
        universal: {
            weeklyChallengeCycleIndex:
                snapshot.universal
                    ?.weeklyChallengeCycleIndex ||
                0,
            weeklyChallengeEndUnixMilliseconds:
                snapshot.universal
                    ?.weeklyChallengeEndUnixMilliseconds ||
                Date.now()
        }
    }
}

export async function bootstrapUserSnapshot(
    walletAddress: string
) {
    const wallet =
        normalizeWalletAddress(
            walletAddress
        )

    const universal =
        await getUniversalSnapshot()

    const rawUser =
        await readDb<any>(
            `users/${wallet}`
        )

    if (!rawUser) {
        const newUser =
            buildDefaultUserSnapshot(
                wallet,
                universal
            )

        await writeDb(
            `users/${wallet}`,
            buildStoredUserRecord(newUser)
        )
        await deleteDb(
            `users/${wallet}/universal`
        )

        return newUser
    }

    const existingUser =
        mergeSnapshot(
            wallet,
            rawUser,
            universal
        )

    await writeDb(
        `users/${wallet}`,
        buildStoredUserRecord(existingUser)
    )
    await deleteDb(
        `users/${wallet}/universal`
    )

    return existingUser
}

export async function syncUserSnapshot(
    snapshot: UserSnapshot
) {
    const cleanSnapshot =
        sanitizeSnapshot(snapshot)

    await writeDb(
        `users/${cleanSnapshot.walletAddress}`,
        buildStoredUserRecord(cleanSnapshot)
    )
    await deleteDb(
        `users/${cleanSnapshot.walletAddress}/universal`
    )
    await patchDb(
        "universal/currentChallenge",
        cleanSnapshot.universal
    )

    return cleanSnapshot
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

    const revives =
        user.revives + Math.max(0, amount)

    const snapshot = {
        ...user,
        revives,
        lives: revives
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
