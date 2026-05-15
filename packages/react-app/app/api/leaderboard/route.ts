import { NextResponse } from "next/server"

import {
    submitChallengeScore,
    getChallengeLeaderboard
} from "@/lib/Leaderboard"


export async function POST(
    request: Request
) {
    try {
        const body =
            await request.json()

        const action =
            body.action

        // =========================
        // SUBMIT SCORE
        // =========================
        if (action === "submit") {
            const walletAddress =
                body.walletAddress

            const playerName =
                body.playerName ||
                "Guest"

            const cycleIndex =
                Number(
                    body.cycleIndex || 0
                )

            const patternName =
                body.patternName ||
                "Unknown"

            const completionSeconds =
                Number(
                    body.completionSeconds || 0
                )

            if (!walletAddress) {
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

            const result =
                await submitChallengeScore(
                    walletAddress,
                    playerName,
                    cycleIndex,
                    patternName,
                    completionSeconds
                )

            return NextResponse.json({
                success: true,
                result
            })
        }

        // =========================
        // GET LEADERBOARD
        // =========================
        if (action === "get") {
            const cycleIndex =
                Number(
                    body.cycleIndex || 0
                )

            const patternName =
                body.patternName ||
                "Unknown"

            const limit =
                Number(
                    body.limit || 10
                )

            const playerWallet =
                body.walletAddress

            const leaderboard =
                await getChallengeLeaderboard(
                    cycleIndex,
                    patternName,
                    limit,
                    playerWallet
                )

            return NextResponse.json({
                success: true,
                entries:
                    leaderboard.entries,

                playerRank:
                    leaderboard.playerRank
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
            "Leaderboard API Error",
            error
        )

        return NextResponse.json(
            {
                success: false,
                error:
                    error?.message ||
                    "Leaderboard API failed"
            },
            {
                status: 500
            }
        )
    }
}