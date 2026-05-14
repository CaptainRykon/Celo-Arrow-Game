import { NextResponse } from "next/server"
import { db } from "@/lib/firebase-admin"

export async function POST(req: Request) {
    try {
        const { gameName } = await req.json()

        if (!gameName || typeof gameName !== "string") {
            return NextResponse.json({ error: "Invalid game name" }, { status: 400 })
        }

        const snap = await db
            .ref(`leaderboards/${gameName}`)
            .orderByChild("score")
            .limitToLast(50)
            .get()

        if (!snap.exists()) {
            return NextResponse.json([])
        }

        const leaderboard = Object.values(snap.val())
            .filter((entry: any) => entry && typeof entry.score === "number")
            .sort((a: any, b: any) => b.score - a.score)

        return NextResponse.json(leaderboard)
    } catch (err) {
        console.error(err)
        return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
}
