import { NextResponse } from "next/server"

import {
    submitChallengeScore,
    getChallengeLeaderboard
} from "@/lib/Leaderboard"

const MAX_LEADERBOARD_ENTRIES = 25

function clampLimit(
    value: unknown
) {
    const numericValue = Number(
        value
    )

    if (!Number.isFinite(numericValue))
        return MAX_LEADERBOARD_ENTRIES

    return Math.min(
        MAX_LEADERBOARD_ENTRIES,
        Math.max(1, Math.floor(numericValue))
    )
}

export async function POST(
    request: Request
) {
    try {
        const body =
            await request.json()

        const action =
            body.action

        if (action === "submit") {
            const walletAddress =
                body.walletAddress
            const playerName =
                body.playerName ||
                "Guest"
            const cycleIndex = Number(
                body.cycleIndex || 0
            )
            const patternName =
                body.patternName ||
                "Unknown"
            const completionSeconds = Number(
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

        if (action === "get") {
            const cycleIndex = Number(
                body.cycleIndex || 0
            )
            const patternName =
                body.patternName ||
                "Unknown"
            const limit = clampLimit(
                body.limit
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
