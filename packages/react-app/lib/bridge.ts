export function sendToUnity(method: string, payload: any = "") {
    if (typeof window === "undefined") return

    const unityInstance = (window as any).unityInstance

    if (!unityInstance) {
        console.log("Unity instance missing")
        return
    }

    unityInstance.SendMessage(
        "MiniPayBridge",
        method,
        typeof payload === "string"
            ? payload
            : JSON.stringify(payload)
    )
}