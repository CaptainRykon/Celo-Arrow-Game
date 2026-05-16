import { NextResponse } from "next/server"

import {
    bootstrapUserSnapshot
} from "@/lib/server-user-state"

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

        const snapshot =
            await bootstrapUserSnapshot(
                wallet
            )

        return NextResponse.json({
            success: true,
            snapshot
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
