import { NextResponse } from "next/server"
import { db } from "@/lib/firebase-admin"

export async function POST(req: Request) {
    try {
        const body = await req.json()

        const { wallet, username, score, gameName } = body

        if (!wallet || !username || typeof score !== "number") {
            return NextResponse.json({ error: "Invalid data" }, { status: 400 })
        }

        if (score < 0 || score > 1000000) {
            return NextResponse.json({ error: "Invalid score" }, { status: 400 })
        }

        const refPath = `leaderboards/${gameName}/${wallet}`
        await db.ref(refPath).transaction((current) => {
            if (!current || score > current.score) {
                return {
                    username,
                    score,
                    timestamp: Date.now()
                }
            }

            return current
        })

        return NextResponse.json({ success: true })

    } catch (err) {
        console.error(err)
        return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
}
