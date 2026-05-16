import "server-only"

function normalizeDatabaseUrl(
    rawUrl?: string
) {
    if (!rawUrl)
        return undefined

    const trimmed =
        rawUrl.trim().replace(/\/+$/, "")

    try {
        const url =
            new URL(trimmed)

        if (
            /firebaseio\.com$/i.test(
                url.hostname
            ) ||
            /firebasedatabase\.app$/i.test(
                url.hostname
            )
        ) {
            url.pathname = "/"
            url.search = ""
            url.hash = ""
            return url
                .toString()
                .replace(/\/$/, "")
        }
    } catch {
    }

    return trimmed
}

const databaseUrl =
    normalizeDatabaseUrl(
        process.env
            .NEXT_PUBLIC_FIREBASE_DATABASE_URL
    )

const databaseSecret =
    process.env
        .FIREBASE_DATABASE_SECRET

function buildDbUrl(
    path: string
) {
    if (!databaseUrl) {
        throw new Error(
            "Firebase database URL is missing."
        )
    }

    const normalizedPath =
        path
            .replace(/^\/+/, "")
            .replace(/\/+$/, "")

    const url = new URL(
        normalizedPath
            ? `${databaseUrl}/${normalizedPath}.json`
            : `${databaseUrl}/.json`
    )

    if (databaseSecret) {
        url.searchParams.set(
            "auth",
            databaseSecret
        )
    }

    return url.toString()
}

async function requestJson<T>(
    method: string,
    path: string,
    body?: unknown
) {
    const response =
        await fetch(
            buildDbUrl(path),
            {
                method,
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body:
                    body === undefined
                        ? undefined
                        : JSON.stringify(body),
                cache: "no-store"
            }
        )

    if (!response.ok) {
        throw new Error(
            `Firebase ${method} ${path} failed with ${response.status}.`
        )
    }

    return await response.json() as T
}

export async function readDb<T>(
    path: string
) {
    return await requestJson<T>(
        "GET",
        path
    )
}

export async function writeDb(
    path: string,
    value: unknown
) {
    return await requestJson(
        "PUT",
        path,
        value
    )
}

export async function patchDb(
    path: string,
    value: unknown
) {
    return await requestJson(
        "PATCH",
        path,
        value
    )
}

export async function deleteDb(
    path: string
) {
    return await requestJson(
        "DELETE",
        path
    )
}
