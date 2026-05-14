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

declare global {
    interface Window {
        unityInstance?: any
    }
}


export default function GameClient() {

    const initialized =
        useRef(false)

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

                console.error(error)

            }
        }

        preload()

        async function handleMessage(
            event: MessageEvent
        ) {

            const data = event.data

            if (!data) return

            try {

                switch (data.type) {

                    // =========================
                    // BOOTSTRAP
                    // =========================

                    case "MINIPAY_BOOTSTRAP":

                        await handleBootstrap()

                        break

                    // =========================
                    // SYNC USER STATE
                    // =========================

                    case "MINIPAY_SYNC_USER_STATE":

                        await handleSync(
                            data.payload
                        )

                        break

                    // =========================
                    // PURCHASE GAME
                    // =========================

                    case "MINIPAY_PURCHASE_GAME":

                        await handlePurchaseGame(
                            data.payload
                        )

                        break

                    // =========================
                    // BUY HINTS
                    // =========================

                    case "MINIPAY_BUY_HINTS":

                        await handleBuyHints(
                            data.payload
                        )

                        break

                    // =========================
                    // BUY LIVES
                    // =========================

                    case "MINIPAY_BUY_LIVES":

                        await handleBuyLives(
                            data.payload
                        )

                        break

                    // =========================
                    // SUBMIT SCORE
                    // =========================

                    case "MINIPAY_SUBMIT_SCORE":

                        await handleSubmitScore(
                            data.payload
                        )

                        break

                    // =========================
                    // GET LEADERBOARD
                    // =========================

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

    // =========================
    // BOOTSTRAP
    // =========================

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

    // =========================
    // SYNC USER STATE
    // =========================

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

    // =========================
    // PURCHASE GAME
    // =========================

    async function handlePurchaseGame(
        payload: any
    ) {

        try {

            const response =
                await apiPost(
                    "/api/purchase",
                    {
                        action: "game",

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
            )

        } catch (error: any) {

            sendToUnity(
                "OnGamePurchaseFailed",
                error?.message ||
                "Purchase failed"
            )
        }
    }

    // =========================
    // BUY HINTS
    // =========================

    async function handleBuyHints(
        payload: any
    ) {

        try {

            const response =
                await apiPost(
                    "/api/purchase",
                    {
                        action: "hints",

                        amount:
                            payload.amount,

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
            )

        } catch (error: any) {

            sendToUnity(
                "OnHintPurchaseFailed",
                error?.message ||
                "Hint purchase failed"
            )
        }
    }

    // =========================
    // BUY LIVES
    // =========================

    async function handleBuyLives(
        payload: any
    ) {

        try {

            const response =
                await apiPost(
                    "/api/purchase",
                    {
                        action: "lives",

                        amount:
                            payload.amount,

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
            )

        } catch (error: any) {

            sendToUnity(
                "OnLivesPurchaseFailed",
                error?.message ||
                "Lives purchase failed"
            )
        }
    }

    // =========================
    // SUBMIT SCORE
    // =========================

    async function handleSubmitScore(
        payload: any
    ) {

        await apiPost(
            "/api/leaderboard",
            {
                action: "submit",
                ...payload
            }
        )
    }

    // =========================
    // GET LEADERBOARD
    // =========================

    async function handleGetLeaderboard(
        payload: any
    ) {

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
            {
                entries:
                    response.entries,

                playerRank:
                    response.playerRank
            }
        )
    }

    return null
}