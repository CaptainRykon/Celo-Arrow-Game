import { NextResponse } from "next/server"

import {
    getChallengeProgress,
    consumeChallengeChance,
    addChallengeChances,
    updateBestChallengeTime,
    updateChallengeStreak
} from "@/lib/challenge"

export async function POST(
    request: Request
) {
    try {
        const body =
            await request.json()

        const action =
            body.action

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

        // =========================
        // GET PROGRESS
        // =========================
        if (action === "get") {
            const progress =
                await getChallengeProgress(
                    wallet
                )

            return NextResponse.json({
                success: true,
                progress
            })
        }

        // =========================
        // CONSUME CHANCE
        // =========================
        if (
            action === "consume"
        ) {
            const result =
                await consumeChallengeChance(
                    wallet
                )

            return NextResponse.json(
                result
            )
        }

        // =========================
        // ADD CHANCES
        // =========================
        if (action === "add") {
            const amount =
                Number(body.amount || 0)

            const result =
                await addChallengeChances(
                    wallet,
                    amount
                )

            return NextResponse.json(
                result
            )
        }

        // =========================
        // UPDATE BEST TIME
        // =========================
        if (
            action === "bestTime"
        ) {
            const seconds =
                Number(
                    body.seconds || -1
                )

            const result =
                await updateBestChallengeTime(
                    wallet,
                    seconds
                )

            return NextResponse.json({
                success: true,
                progress:
                    result
            })
        }

        // =========================
        // UPDATE STREAK
        // =========================
        if (
            action === "streak"
        ) {
            const cycleIndex =
                Number(
                    body.cycleIndex || 0
                )

            const dayIndex =
                Number(
                    body.dayIndex || 0
                )

            const result =
                await updateChallengeStreak(
                    wallet,
                    cycleIndex,
                    dayIndex
                )

            return NextResponse.json({
                success: true,
                progress:
                    result
            })
        }

        return NextResponse.json(
            {
                success: false,
                error:
                    "Unknown action"
            },
            {
                status: 400
            }
        )
    } catch (error: any) {
        console.error(
            "Challenge API Error",
            error
        )

        return NextResponse.json(
            {
                success: false,
                error:
                    error?.message ||
                    "Challenge API failed"
            },
            {
                status: 500
            }
        )
    }
} 