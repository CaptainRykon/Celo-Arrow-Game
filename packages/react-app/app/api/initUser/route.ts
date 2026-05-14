import { NextResponse } from "next/server"
import { db } from "@/lib/firebase-admin"

function getMidnight() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
}

export async function POST(req: Request) {
    try {
        const { wallet, username } = await req.json()
        const walletKey = wallet?.trim()
        const safeUsername = username?.trim()

        if (!walletKey || !safeUsername) {
            return NextResponse.json({ error: "Invalid data" }, { status: 400 })
        }

        const ref = db.ref(`users/${walletKey}`)
        const snap = await ref.get()

        // ? Only create if NOT exists
        if (!snap.exists()) {
            await ref.set({
                username: safeUsername,
                chances: 1,
                lastReset: getMidnight()
            })
        }

        return NextResponse.json({ success: true })

    } catch (err) {
        console.error(err)
        return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
}
