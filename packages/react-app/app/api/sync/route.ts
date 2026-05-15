import { NextResponse } from "next/server"

import {
    ref,
    update,
    get,
    set
} from "firebase/database"

import { getDb } from "@/lib/firebase"

import type {
    UserSnapshot
} from "@/lib/types"

function sanitizeSnapshot(
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

export async function POST(
    request: Request
) {
    try {
        const body =
            await request.json()

        const snapshot =
            body.snapshot as UserSnapshot

        if (
            !snapshot ||
            !snapshot.walletAddress
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Invalid snapshot"
                },
                {
                    status: 400
                }
            )
        }

        const cleanSnapshot =
            sanitizeSnapshot(
                snapshot
            )

        const userRef = ref(
            getDb(),
            `users/${cleanSnapshot.walletAddress}`
        )

        // CHECK EXISTING USER
        const existing =
            await get(userRef)

        if (!existing.exists()) {
            await set(
                userRef,
                cleanSnapshot
            )
        } else {
            await update(
                userRef,
                cleanSnapshot
            )
        }

        // UPDATE UNIVERSAL DATA
        await update(
            ref(
                getDb(),
                "universal/currentChallenge"
            ),
            cleanSnapshot.universal
        )

        return NextResponse.json({
            success: true,
            snapshot:
                cleanSnapshot
        })
    } catch (error: any) {
        console.error(
            "Sync API Error",
            error
        )

        return NextResponse.json(
            {
                success: false,
                error:
                    error?.message ||
                    "Sync failed"
            },
            {
                status: 500
            }
        )
    }
}
