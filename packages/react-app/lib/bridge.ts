function buildPayload(
    payload: any
) {
    return typeof payload === "string"
        ? payload
        : JSON.stringify(payload)
}

export function sendToUnity(
    method: string,
    payload: any = ""
) {
    if (typeof window === "undefined")
        return

    const value =
        buildPayload(payload)

    const iframe =
        document.querySelector("iframe") as HTMLIFrameElement | null

    if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(
            {
                type: "UNITY_CALLBACK",
                method,
                value
            },
            "*"
        )

        return
    }

    const unityInstance =
        (window as any).unityInstance

    if (unityInstance?.SendMessage) {
        unityInstance.SendMessage(
            "MiniPayBridge",
            method,
            value
        )

        return
    }

    console.log(
        "Unity target missing",
        method
    )
}
