import { NextResponse } from "next/server"

import {
    ref,
    get,
    set
} from "firebase/database"

import { db } from "@/lib/firebase"

import {
    getClassicProgress
} from "@/lib/classic"

import {
    getChallengeProgress
} from "@/lib/challenge"

import {
    getUniversalData
} from "@/lib/universal"

import type {
    UserSnapshot
} from "@/lib/types"

function createDefaultUser(
    wallet: string
): UserSnapshot {
    return {
        walletAddress: wallet,
        username: "Guest",
        hasPurchasedGame: false,
        lives: 3,
        hints: 10,
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

        universal: {
            weeklyChallengeCycleIndex: 0,
            weeklyChallengeEndUnixMilliseconds:
                Date.now() +
                7 *
                24 *
                60 *
                60 *
                1000
        }
    }
}

export async function POST(
    request: Request
) {
    try {
        const body =
            await request.json()

        const wallet =
            body.walletAddress

        const username =
            body.username || "Guest"

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

        const userRef = ref(
            db,
            `users/${wallet}`
        )

        const snapshot =
            await get(userRef)

        // CREATE USER
        if (!snapshot.exists()) {
            const defaultUser =
                createDefaultUser(wallet)

            defaultUser.username =
                username

            await set(
                userRef,
                defaultUser
            )

            return NextResponse.json({
                success: true,
                snapshot:
                    defaultUser
            })
        }

        const user =
            snapshot.val()

        // ENSURE MODULES EXIST
        const classic =
            await getClassicProgress(
                wallet
            )

        const challenge =
            await getChallengeProgress(
                wallet
            )

        const universal =
            await getUniversalData()

        const finalSnapshot: UserSnapshot =
        {
            walletAddress:
                wallet,

            username:
                user.username ||
                "Guest",

            hasPurchasedGame:
                !!user.hasPurchasedGame,

            lives:
                user.lives || 3,

            hints:
                user.hints || 10,

            tutorialCompleted:
                !!user.tutorialCompleted,

            classic,

            challenge,

            universal:
                universal || {
                    weeklyChallengeCycleIndex: 0,

                    weeklyChallengeEndUnixMilliseconds:
                        Date.now() +
                        7 *
                        24 *
                        60 *
                        60 *
                        1000
                }
        }

        return NextResponse.json({
            success: true,
            snapshot:
                finalSnapshot
        })
    } catch (error: any) {
        console.error(
            "Bootstrap API Error",
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