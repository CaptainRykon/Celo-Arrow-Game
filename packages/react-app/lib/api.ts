export async function apiPost(url: string, body: any) {
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    })

    if (!res.ok) {
        const rawBody =
            await res.text()

        try {
            const parsed =
                JSON.parse(rawBody)

            throw new Error(
                parsed?.error ||
                parsed?.message ||
                rawBody
            )
        } catch {
            throw new Error(rawBody)
        }
    }

    return await res.json()
}
