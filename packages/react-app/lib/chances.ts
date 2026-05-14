export async function getUser(wallet: string) {
    if (!wallet) return null

    const res = await fetch("/api/getUser", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ wallet })
    })

    if (!res.ok) {
        console.error("getUser API failed")
        return null
    }

    return await res.json()
}

export async function initUser(wallet: string, username: string) {
    await fetch("/api/initUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, username })
    })
}

export async function consumeChance(wallet: string) {
    const res = await fetch("/api/useChance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet })
    })

    const data = await res.json()

    if (!data.success) return null

    return data.user ?? null
}

export async function updateUsername(wallet: string, username: string) {
    const res = await fetch("/api/updateUsername", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, username })
    })

    return await res.json()
}

export async function addChances(wallet: string, amount: number) {
    const res = await fetch("/api/addChance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, amount })
    })

    return await res.json()
}
