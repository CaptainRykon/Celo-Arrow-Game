import { NextResponse } from "next/server"
import { db } from "@/lib/firebase-admin"

function getMidnight() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
}

function withNextReset(data: any) {
    return {
        ...data,
        nextReset: (data.lastReset ?? getMidnight()) + 86400000
    }
}

export async function POST(req: Request) {
    try {
        const { wallet, username } = await req.json()

        if (!wallet || !username) {
            return NextResponse.json({ error: "Invalid data" }, { status: 400 })
        }

        const today = getMidnight()
        const result = await db.ref(`users/${wallet}`).transaction((current) => {
            const data = current ?? {
                username,
                chances: 1,
                lastReset: today
            }

            return {
                ...data,
                username
            }
        })

        return NextResponse.json({
            success: true,
            user: result.snapshot.exists() ? withNextReset(result.snapshot.val()) : null
        })

    } catch (err) {
        console.error(err)
        return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
}
