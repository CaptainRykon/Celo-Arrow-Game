import { NextResponse } from "next/server"

import {
    ref,
    get,
    set
} from "firebase/database"

import { getDb } from "@/lib/firebase"

export async function POST(
    request: Request
) {

    try {

        const body =
            await request.json()

        const wallet =
            body.walletAddress

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

        const snapshot =
            await get(userRef)

        // =====================================================
        // CREATE NEW USER
        // =====================================================

        if (!snapshot.exists()) {

            const newUser = {

                walletAddress:
                    wallet,

                username:
                    "Player",

                hasPurchasedGame:
                    false,

                lives: 3,

                hints: 0,

                tutorialCompleted:
                    false,

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

                universal: {
                    weeklyChallengeCycleIndex: 0,

                    weeklyChallengeEndUnixMilliseconds: 0
                }
            }

            await set(
                userRef,
                newUser
            )

            return NextResponse.json({
                success: true,
                snapshot: newUser
            })
        }

        // =====================================================
        // EXISTING USER
        // =====================================================

        return NextResponse.json({
            success: true,
            snapshot:
                snapshot.val()
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