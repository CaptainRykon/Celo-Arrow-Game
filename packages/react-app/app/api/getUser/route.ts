import { NextResponse } from "next/server"
import { db } from "@/lib/firebase-admin"

function getMidnight() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
}

export async function POST(req: Request) {
    try {
        const { wallet } = await req.json()

        if (!wallet) {
            return NextResponse.json({ error: "Invalid wallet" }, { status: 400 })
        }

        const snap = await db.ref(`users/${wallet}`).get()

        if (!snap.exists()) {
            return NextResponse.json({
                exists: false
            })
        }

        const data = snap.val()
        const today = getMidnight()
        const lastReset = typeof data.lastReset === "number" ? data.lastReset : today
        const nextReset = lastReset + 86400000

        // Keep chance state in sync with reset window when user opens app after reset time.
        if (nextReset <= Date.now() && (data.chances ?? 0) <= 0) {
            const updated = {
                ...data,
                chances: 1,
                lastReset: today
            }
            await db.ref(`users/${wallet}`).set(updated)
            return NextResponse.json({
                ...updated,
                nextReset: today + 86400000
            })
        }

        return NextResponse.json({
            ...data,
            nextReset
        })

    } catch (err) {
        console.error(err)
        return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
}