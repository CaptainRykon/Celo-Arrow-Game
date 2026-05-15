import { NextResponse } from "next/server"

import {
    ref,
    get,
    set,
    remove
} from "firebase/database"

import { getDb } from "@/lib/firebase"
import type { UniversalProgress, UserSnapshot } from "@/lib/types"

const DEFAULT_UNIVERSAL: UniversalProgress = {
    weeklyChallengeCycleIndex: 0,
    weeklyChallengeEndUnixMilliseconds: 0
}

function buildDefaultUser(
    walletAddress: string,
    universal: UniversalProgress
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

function buildStoredUser(
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

async function getUniversalData() {
    const universalRef =
        ref(
            getDb(),
            "universal/currentChallenge"
        )

    const snapshot =
        await get(universalRef)

    if (!snapshot.exists()) {
        await set(
            universalRef,
            DEFAULT_UNIVERSAL
        )

        return DEFAULT_UNIVERSAL
    }

    return {
        weeklyChallengeCycleIndex:
            Number(
                snapshot.val()?.weeklyChallengeCycleIndex ??
                DEFAULT_UNIVERSAL.weeklyChallengeCycleIndex
            ),
        weeklyChallengeEndUnixMilliseconds:
            Number(
                snapshot.val()?.weeklyChallengeEndUnixMilliseconds ??
                DEFAULT_UNIVERSAL.weeklyChallengeEndUnixMilliseconds
            )
    }
}

export async function POST(
    request: Request
) {

    try {

        const body =
            await request.json()

        const wallet =
            typeof body.walletAddress === "string"
                ? body.walletAddress.trim()
                : ""

        if (!wallet) {

            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Wallet missing"
                },
                {
                    status: 400
                }
            )
        }

        const userRef =
            ref(
                getDb(),
                `users/${wallet}`
            )

        const universal =
            await getUniversalData()

        const snapshot =
            await get(userRef)

        // =====================================================
        // CREATE NEW USER
        // =====================================================

        if (!snapshot.exists()) {

            const newUser =
                buildDefaultUser(
                    wallet,
                    universal
                )

            await set(
                userRef,
                buildStoredUser(newUser)
            )
            await remove(
                ref(
                    getDb(),
                    `users/${wallet}/universal`
                )
            )

            return NextResponse.json({
                success: true,
                snapshot: newUser
            })
        }

        // =====================================================
        // EXISTING USER
        // =====================================================

        await remove(
            ref(
                getDb(),
                `users/${wallet}/universal`
            )
        )

        const existingUser = {
            ...buildDefaultUser(
                wallet,
                universal
            ),
            ...snapshot.val(),
            revives:
                Math.max(
                    0,
                    snapshot.val()?.revives ??
                    snapshot.val()?.lives ??
                    3
                ),
            lives:
                Math.max(
                    0,
                    snapshot.val()?.revives ??
                    snapshot.val()?.lives ??
                    3
                ),
            universal
        }

        return NextResponse.json({
            success: true,
            snapshot:
                existingUser
        })

    } catch (error: any) {

        console.error(
            "Bootstrap Error",
            error
        )

        return NextResponse.json(
            {
                success: false,
                error:
                    error?.message ||
                    "Bootstrap failed"
            },
            {
                status: 500
            }
        )
    }
}
