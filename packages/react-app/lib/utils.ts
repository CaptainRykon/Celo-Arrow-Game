export function sleep(ms: number) {
    return new Promise((resolve) =>
        setTimeout(resolve, ms)
    )
}

export function now() {
    return Date.now()
}

export function safeJsonParse<T>(
    value: string,
    fallback: T
): T {
    try {
        return JSON.parse(value)
    } catch {
        return fallback
    }
}

export function clamp(
    value: number,
    min: number,
    max: number
) {
    return Math.min(
        Math.max(value, min),
        max
    )
}