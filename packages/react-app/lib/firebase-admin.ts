function getRequiredEnv(name: string): string {
    const value = process.env[name]
    if (!value) {
        throw new Error(`Missing required Firebase env var: ${name}`)
    }
    return value
}

function getBaseUrl(): string {
    return getRequiredEnv("FIREBASE_DATABASE_URL").replace(/\/+$/, "")
}

function getAuthQuery(): string {
    const secret = getRequiredEnv("FIREBASE_DATABASE_SECRET")
    return `auth=${encodeURIComponent(secret)}`
}

function makeUrl(path: string): string {
    const cleanPath = path.replace(/^\/+/, "")
    return `${getBaseUrl()}/${cleanPath}.json?${getAuthQuery()}`
}

type Snapshot = {
    exists: () => boolean
    val: () => any
}

function createSnapshot(value: any): Snapshot {
    return {
        exists: () => value !== null && value !== undefined,
        val: () => value
    }
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
    const res = await fetch(url, init)
    if (!res.ok) {
        const body = await res.text()
        throw new Error(`Firebase REST error ${res.status}: ${body}`)
    }
    return res.json()
}

export const db = {
    ref(path: string) {
        const url = makeUrl(path)
        return {
            async get() {
                const value = await fetchJson(url)
                return createSnapshot(value)
            },
            async set(data: any) {
                await fetchJson(url, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                })
            },
            async update(data: Record<string, any>) {
                await fetchJson(url, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                })
            },
            async transaction(updateFn: (current: any) => any) {
                const current = await fetchJson(url)
                const updated = updateFn(current)
                if (updated === undefined) {
                    return {
                        committed: false,
                        snapshot: createSnapshot(current)
                    }
                }
                await fetchJson(url, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updated)
                })
                return {
                    committed: true,
                    snapshot: createSnapshot(updated)
                }
            }
        }
    }
}