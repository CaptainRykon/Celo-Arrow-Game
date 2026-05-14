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
        const body = await req.json()
        const { wallet, amount } = body
        const walletKey = wallet?.trim()

        if (!walletKey || typeof amount !== "number" || amount <= 0) {
            return NextResponse.json({ error: "Invalid data" }, { status: 400 })
        }

        const today = getMidnight()
        const ref = db.ref(`users/${walletKey}`)
        const result = await ref.transaction((current) => {
            const data = current ?? {
                username: "Guest",
                chances: 0,
                lastReset: today
            }

            const isNewDay = (data.lastReset ?? 0) < today
            const baseChances = isNewDay ? 1 : (data.chances || 0)

            let newChances = baseChances + amount
            if (newChances > 12) {
                newChances = 12
            }

            return {
                ...data,
                chances: newChances,
                lastReset: isNewDay ? today : (data.lastReset ?? today)
            }
        })

        const updated = result.snapshot.val()

        return NextResponse.json({
            success: true,
            chances: updated?.chances ?? amount,
            user: updated ? withNextReset(updated) : null
        })

    } catch (err) {
        console.error(err)
        return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
}
