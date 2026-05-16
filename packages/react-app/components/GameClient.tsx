"use client"

import {
    useEffect,
    useRef
} from "react"

import {
    getWalletSafe
} from "@/lib/wallet"

import {
    sendToUnity
} from "@/lib/bridge"

import {
    apiPost
} from "@/lib/api"

import {
    runMiniPayPayment
} from "@/lib/purchase"

declare global {
    interface Window {
        unityInstance?: any
        ethereum?: any
    }
}

export default function GameClient() {

    const initialized =
        useRef(false)

    // =========================================================
    // INITIALIZE
    // =========================================================

    useEffect(() => {

        if (initialized.current)
            return

        initialized.current = true

        async function preload() {

            try {

                const wallet =
                    await getWalletSafe()

                if (!wallet) {
                    console.log(
                        "Wallet not connected yet"
                    )

                    return
                }

                await bootstrap(wallet)

            } catch (error) {

                console.error(
                    "Preload failed",
                    error
                )
            }
        }

        preload()

        async function handleMessage(
            event: MessageEvent
        ) {

            const data = event.data

            if (!data)
                return

            try {

                switch (data.type) {

                    // =========================================================
                    // BOOTSTRAP
                    // =========================================================

                    case "MINIPAY_BOOTSTRAP":

                        await handleBootstrap()

                        break

                    // =========================================================
                    // SYNC USER STATE
                    // =========================================================

                    case "MINIPAY_SYNC_USER_STATE":

                        await handleSync(
                            data.payload
                        )

                        break

                    // =========================================================
                    // PURCHASE GAME
                    // =========================================================

                    case "MINIPAY_PURCHASE_GAME":

                        await handlePurchaseGame(
                            data.payload
                        )

                        break

                    // =========================================================
                    // BUY HINTS
                    // =========================================================

                    case "MINIPAY_BUY_HINTS":

                        await handleBuyHints(
                            data.payload
                        )

                        break

                    // =========================================================
                    // BUY LIVES
                    // =========================================================

                    case "MINIPAY_BUY_LIVES":

                        await handleBuyLives(
                            data.payload
                        )

                        break

                    // =========================================================
                    // SUBMIT SCORE
                    // =========================================================

                    case "MINIPAY_SUBMIT_SCORE":

                        await handleSubmitScore(
                            data.payload
                        )

                        break

                    // =========================================================
                    // GET LEADERBOARD
                    // =========================================================

                    case "MINIPAY_GET_LEADERBOARD":

                        await handleGetLeaderboard(
                            data.payload
                        )

                        break
                }

            } catch (error: any) {

                console.error(
                    "GameClient Error",
                    error
                )

                sendToUnity(
                    "OnBridgeLogReceived",
                    error?.message ||
                    "Unknown error"
                )
            }
        }

        window.addEventListener(
            "message",
            handleMessage
        )

        return () => {

            window.removeEventListener(
                "message",
                handleMessage
            )
        }

    }, [])

    // =========================================================
    // BOOTSTRAP
    // =========================================================

    async function bootstrap(
        wallet: string
    ) {

        const response =
            await apiPost(
                "/api/bootstrap",
                {
                    walletAddress:
                        wallet
                }
            )

        if (!response.success) {

            throw new Error(
                response.error
            )
        }

        sendToUnity(
            "OnBootstrapDataReceived",
            response.snapshot
        )
    }

    function getPaymentFailureKind(
        error: unknown
    ) {
        const message =
            error instanceof Error
                ? error.message
                : String(
                    error ||
                    "Payment failed"
                )

        const lower =
            message.toLowerCase()

        if (
            lower.includes("cancel") ||
            lower.includes("rejected") ||
            lower.includes("denied") ||
            lower.includes("insufficient")
        ) {
            return {
                message,
                shouldShowFailedPanel: true
            }
        }

        if (
            lower.includes("transaction timeout") ||
            lower.includes("execution reverted") ||
            lower.includes("transaction failed")
        ) {
            return {
                message,
                shouldShowFailedPanel: true
            }
        }

        return {
            message,
            shouldShowFailedPanel: false
        }
    }

    async function handleBootstrap() {

        const wallet =
            await getWalletSafe()

        if (!wallet) {

            sendToUnity(
                "OnWalletAddressResolved",
                ""
            )

            return
        }

        sendToUnity(
            "OnWalletAddressResolved",
            wallet
        )

        await bootstrap(wallet)
    }

    // =========================================================
    // SYNC USER STATE
    // =========================================================

    async function handleSync(
        snapshot: any
    ) {

        const response =
            await apiPost(
                "/api/sync",
                {
                    snapshot
                }
            )

        if (!response.success) {

            throw new Error(
                response.error
            )
        }

        sendToUnity(
            "OnUserStateSynced",
            response.snapshot
        )
    }

    // =========================================================
    // PURCHASE GAME
    // =========================================================

    async function handlePurchaseGame(
        payload: any
    ) {
        try {
            const wallet =
                await runMiniPayPayment(
                    payload?.token ||
                    "USDT"
                )

            try {
                const response =
                    await apiPost(
                        "/api/purchase",
                        {
                            action: "game",
                            walletAddress:
                                wallet,

                            token:
                                payload?.token ||
                                "USDT"
                        }
                    )

                if (!response.success) {
                    throw new Error(
                        response.error
                    )
                }

                sendToUnity(
                    "OnGamePurchaseSuccess",
                    response.result
                        ?.snapshot || ""
                )
            } catch (error: any) {
                console.error(
                    "Purchase sync failed",
                    error
                )

                sendToUnity(
                    "OnGamePurchaseStatus",
                    "Payment completed, but the game could not unlock yet. Please reopen the app."
                )
            }
        } catch (error: any) {
            const result =
                getPaymentFailureKind(
                    error
                )

            if (
                result.shouldShowFailedPanel
            ) {
                sendToUnity(
                    "OnGamePurchaseFailed",
                    result.message
                )
            } else {
                sendToUnity(
                    "OnGamePurchaseStatus",
                    result.message
                )
            }
        }
    }

    // =========================================================
    // BUY HINTS
    // =========================================================

    async function handleBuyHints(
        payload: any
    ) {

        try {
            const wallet =
                await runMiniPayPayment(
                    payload?.token ||
                    "USDT"
                )

            const response =
                await apiPost(
                    "/api/purchase",
                    {
                        action: "hints",
                        walletAddress:
                            wallet,

                        amount:
                            payload?.amount || 1,

                        token:
                            payload?.token ||
                            "USDT"
                    }
                )

            if (!response.success) {

                throw new Error(
                    response.error
                )
            }

            sendToUnity(
                "OnHintPurchaseSuccess",
                response.result
                    ?.snapshot || ""
            )

        } catch (error: any) {

            sendToUnity(
                "OnHintPurchaseFailed",
                error?.message ||
                "Hint purchase failed"
            )
        }
    }

    // =========================================================
    // BUY LIVES
    // =========================================================

    async function handleBuyLives(
        payload: any
    ) {

        try {
            const wallet =
                await runMiniPayPayment(
                    payload?.token ||
                    "USDT"
                )

            const response =
                await apiPost(
                    "/api/purchase",
                    {
                        action: "lives",
                        walletAddress:
                            wallet,

                        amount:
                            payload?.amount || 1,

                        token:
                            payload?.token ||
                            "USDT"
                    }
                )

            if (!response.success) {

                throw new Error(
                    response.error
                )
            }

            sendToUnity(
                "OnLivesPurchaseSuccess",
                response.result
                    ?.snapshot || ""
            )

        } catch (error: any) {

            sendToUnity(
                "OnLivesPurchaseFailed",
                error?.message ||
                "Lives purchase failed"
            )
        }
    }

    // =========================================================
    // SUBMIT SCORE
    // =========================================================

    async function handleSubmitScore(
        payload: any
    ) {

        try {

            const response =
                await apiPost(
                    "/api/leaderboard",
                    {
                        action: "submit",

                        ...payload
                    }
                )

            if (!response.success) {

                throw new Error(
                    response.error
                )
            }

            sendToUnity(
                "OnLeaderboardSubmitted",
                ""
            )

        } catch (error: any) {

            sendToUnity(
                "OnLeaderboardSubmitFailed",
                error?.message ||
                "Leaderboard submit failed"
            )
        }
    }

    // =========================================================
    // GET LEADERBOARD
    // =========================================================

    async function handleGetLeaderboard(
        payload: any
    ) {

        try {

            const response =
                await apiPost(
                    "/api/leaderboard",
                    {
                        action: "get",

                        ...payload
                    }
                )

            if (!response.success) {

                throw new Error(
                    response.error
                )
            }

            sendToUnity(
                "OnChallengeLeaderboardReceived",
                JSON.stringify({
                    entries:
                        response.entries,

                    playerRank:
                        response.playerRank
                })
            )

        } catch (error: any) {

            sendToUnity(
                "OnLeaderboardFailed",
                error?.message ||
                "Leaderboard failed"
            )
        }
    }



    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                overflow: "hidden"
            }}
        >
            <iframe
                src="https://testing.rykonarena.com/index.html"
                style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    display: "block"
                }}
            />
        </div>
    )
}
