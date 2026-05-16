import { NextResponse } from "next/server"

import type {
    UserSnapshot
} from "@/lib/types"

import {
    syncUserSnapshot
} from "@/lib/server-user-state"

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
            await syncUserSnapshot(
                snapshot
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
