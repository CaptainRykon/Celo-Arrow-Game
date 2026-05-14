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
        const { wallet } = await req.json()
        const walletKey = wallet?.trim()

        if (!walletKey) {
            return NextResponse.json({ error: "Invalid wallet" }, { status: 400 })
        }

        const today = getMidnight()
        const ref = db.ref(`users/${walletKey}`)
        let didConsume = false
        const result = await ref.transaction((current) => {
            const data = current ?? {
                username: "Guest",
                chances: 1,
                lastReset: today
            }

            const normalized = (data.lastReset ?? 0) < today
                ? { ...data, chances: 1, lastReset: today }
                : data

            if ((normalized.chances ?? 0) <= 0) {
                didConsume = false
                return normalized
            }

            didConsume = true
            return {
                ...normalized,
                chances: normalized.chances - 1
            }
        })

        if (!result.snapshot.exists()) {
            return NextResponse.json({ success: false })
        }

        const updated = result.snapshot.val()

        if (!didConsume || (updated.chances ?? 0) < 0) {
            return NextResponse.json({
                success: false,
                user: withNextReset(updated)
            })
        }

        return NextResponse.json({
            success: true,
            user: withNextReset(updated)
        })

    } catch (err) {
        console.error(err)
        return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
}
