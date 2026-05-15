import {
    encodeFunctionData
} from "viem"

import type { Address } from "viem"

import {
    getWallet,
    ensureCeloNetwork,
    getEthereum
} from "./wallet"

import {
    ref,
    update,
    get,
    set,
    remove
} from "firebase/database"

import { getDb } from "./firebase"
import type {
    UniversalProgress,
    UserSnapshot
} from "./types"

export type PaymentToken =
    | "USDT"
    | "USDC"
const GAME_CONTRACT =
    "0xd9a8665a4Bb8cde69Ba478F39924891D6e977eB7"

const USDT_CONTRACT: Address =
    "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e"

const DEFAULT_UNIVERSAL: UniversalProgress = {
    weeklyChallengeCycleIndex: 0,
    weeklyChallengeEndUnixMilliseconds: 0
}

function normalizeWalletAddress(
    walletAddress: string
) {
    return walletAddress.trim()
}

function buildDefaultUserSnapshot(
    walletAddress: string,
    universal: UniversalProgress = DEFAULT_UNIVERSAL
): UserSnapshot {
    return {
        walletAddress,
        username: "Player",
        hasPurchasedGame: false,
        revives: 3,
        lives: 3,
        hints: 0,
        tutorialCompleted: false,
        classic: {
            level: 1
        },
        challenge: {
            chances: 1,
            lastResetUnixMilliseconds:
                Date.now(),
            streakCycleIndex: 0,
            streakMask: 0,
            bestTimeSeconds: -1
        },
        universal
    }
}

function buildStoredUserRecord(
    snapshot: UserSnapshot
) {
    return {
        walletAddress:
            snapshot.walletAddress,
        username:
            snapshot.username,
        hasPurchasedGame:
            snapshot.hasPurchasedGame,
        revives:
            snapshot.revives,
        lives:
            snapshot.revives,
        hints:
            snapshot.hints,
        tutorialCompleted:
            snapshot.tutorialCompleted,
        classic:
            snapshot.classic,
        challenge:
            snapshot.challenge
    }
}

function mergeSnapshot(
    walletAddress: string,
    raw: any,
    universal: UniversalProgress
): UserSnapshot {
    const base =
        buildDefaultUserSnapshot(
            walletAddress,
            universal
        )

    const revives =
        Math.max(
            0,
            Number(
                raw?.revives ??
                raw?.lives ??
                base.revives
            )
        )

    return {
        walletAddress,
        username:
            typeof raw?.username === "string" &&
            raw.username.trim()
                ? raw.username.trim()
                : base.username,
        hasPurchasedGame:
            !!raw?.hasPurchasedGame,
        revives,
        lives: revives,
        hints:
            Math.max(
                0,
                Number(
                    raw?.hints ??
                    base.hints
                )
            ),
        tutorialCompleted:
            !!raw?.tutorialCompleted,
        classic: {
            level:
                Math.max(
                    1,
                    Number(
                        raw?.classic?.level ??
                        base.classic.level
                    )
                )
        },
        challenge: {
            chances:
                Math.max(
                    0,
                    Number(
                        raw?.challenge?.chances ??
                        base.challenge.chances
                    )
                ),
            lastResetUnixMilliseconds:
                Number(
                    raw?.challenge?.lastResetUnixMilliseconds ??
                    base.challenge.lastResetUnixMilliseconds
                ),
            streakCycleIndex:
                Number(
                    raw?.challenge?.streakCycleIndex ??
                    base.challenge.streakCycleIndex
                ),
            streakMask:
                Math.max(
                    0,
                    Number(
                        raw?.challenge?.streakMask ??
                        base.challenge.streakMask
                    )
                ),
            bestTimeSeconds:
                Number(
                    raw?.challenge?.bestTimeSeconds ??
                    base.challenge.bestTimeSeconds
                )
        },
        universal
    }
}

async function getUniversalSnapshot() {
    const universalRef =
        ref(
            getDb(),
            "universal/currentChallenge"
        )

    const snapshot =
        await get(universalRef)

    if (!snapshot.exists()) {
        await set(
            universalRef,
            DEFAULT_UNIVERSAL
        )

        return DEFAULT_UNIVERSAL
    }

    return {
        weeklyChallengeCycleIndex:
            Number(
                snapshot.val()?.weeklyChallengeCycleIndex ??
                DEFAULT_UNIVERSAL.weeklyChallengeCycleIndex
            ),
        weeklyChallengeEndUnixMilliseconds:
            Number(
                snapshot.val()?.weeklyChallengeEndUnixMilliseconds ??
                DEFAULT_UNIVERSAL.weeklyChallengeEndUnixMilliseconds
            )
    }
}

async function getOrCreateUserSnapshot(
    wallet: Address
) {
    const normalizedWallet =
        normalizeWalletAddress(wallet)

    const universal =
        await getUniversalSnapshot()

    const userRef =
        ref(
            getDb(),
            `users/${normalizedWallet}`
        )

    const snapshot =
        await get(userRef)

    if (!snapshot.exists()) {
        const user =
            buildDefaultUserSnapshot(
                normalizedWallet,
                universal
            )

        await set(
            userRef,
            buildStoredUserRecord(user)
        )
        await remove(
            ref(
                getDb(),
                `users/${normalizedWallet}/universal`
            )
        )
        return user
    }

    const user =
        mergeSnapshot(
            normalizedWallet,
            snapshot.val(),
            universal
        )

    await set(
        userRef,
        buildStoredUserRecord(user)
    )
    await remove(
        ref(
            getDb(),
            `users/${normalizedWallet}/universal`
        )
    )

    return user
}

const ERC20_ABI = [
    {
        name: "approve",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            {
                name: "spender",
                type: "address"
            },
            {
                name: "amount",
                type: "uint256"
            }
        ],
        outputs: []
    }
]

const PAYMENT_ABI = [
    {
        name: "payWithUSDT",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [],
        outputs: []
    },

    {
        name: "payWithUSDC",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [],
        outputs: []
    }
]

async function waitForTransaction(
    txHash: string
) {
    const ethereum = getEthereum()

    if (!ethereum) {
        throw new Error("Wallet missing")
    }

    while (true) {
        const receipt =
            await ethereum.request({
                method:
                    "eth_getTransactionReceipt",

                params: [txHash]
            })

        if (receipt) {
            return receipt
        }

        await new Promise((r) =>
            setTimeout(r, 2000)
        )
    }
}

async function approveIfNeeded(
    wallet: Address,
    cacheKey: string
) {
    const approved =
        localStorage.getItem(cacheKey)

    if (approved === "true") {
        return
    }

    const ethereum = getEthereum()

    if (!ethereum) {
        throw new Error("Wallet missing")
    }

    const approveData =
        encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "approve",
            args: [
                GAME_CONTRACT,
                BigInt("999999999")
            ]
        })

    const tx =
        await ethereum.request({
            method: "eth_sendTransaction",
            params: [
                {
                    from: wallet,
                    to: USDT_CONTRACT,
                    data: approveData
                }
            ]
        })

    await waitForTransaction(tx)

    localStorage.setItem(
        cacheKey,
        "true"
    )
}

function normalizeMiniPayError(
    error: unknown
) {
    const rawMessage =
        error instanceof Error
            ? error.message
            : String(error || "Payment failed")

    const lower =
        rawMessage.toLowerCase()

    if (
        lower.includes("user rejected") ||
        lower.includes("user denied") ||
        lower.includes("cancel")
    ) {
        return "Payment was cancelled."
    }

    if (
        lower.includes("insufficient")
    ) {
        return "Payment failed due to insufficient balance."
    }

    if (
        lower.includes("wallet not found") ||
        lower.includes("no wallet")
    ) {
        return "MiniPay wallet not found."
    }

    if (
        lower.includes("wrong network")
    ) {
        return "Please switch MiniPay to the Celo network."
    }

    return rawMessage
}

async function sendPayment(
    token: PaymentToken
) {
    try {
        const wallet = await getWallet()

        await ensureCeloNetwork()

        await approveIfNeeded(
            wallet,
            "minipay_approved"
        )

        const ethereum = getEthereum()

        if (!ethereum) {
            throw new Error("Wallet missing")
        }

        const paymentData =
            encodeFunctionData({
                abi: PAYMENT_ABI,

                functionName:
                    token === "USDC"
                        ? "payWithUSDC"
                        : "payWithUSDT",

                args: []
            })

        const tx =
            await ethereum.request({
                method: "eth_sendTransaction",
                params: [
                    {
                        from: wallet,
                        to: GAME_CONTRACT,
                        data: paymentData
                    }
                ]
            })

        await waitForTransaction(tx)

        return wallet
    } catch (error) {
        throw new Error(
            normalizeMiniPayError(error)
        )
    }
}

export async function runMiniPayPayment(
    token: PaymentToken = "USDT"
) {
    return await sendPayment(token)
}

export async function completeGamePurchase(
    walletAddress: string
) {
    const user =
        await getOrCreateUserSnapshot(
            walletAddress as Address
        )

    const wallet =
        normalizeWalletAddress(
            walletAddress
        )

    const snapshot = {
        ...user,
        hasPurchasedGame: true
    }

    await update(
        ref(getDb(), `users/${wallet}`),
        buildStoredUserRecord(snapshot)
    )
    await remove(
        ref(
            getDb(),
            `users/${wallet}/universal`
        )
    )

    return {
        success: true,
        snapshot
    }
}

export async function completeHintPurchase(
    walletAddress: string,
    amount: number
) {
    const user =
        await getOrCreateUserSnapshot(
            walletAddress as Address
        )

    const wallet =
        normalizeWalletAddress(
            walletAddress
        )

    const hints =
        user.hints + Math.max(0, amount)

    const snapshot = {
        ...user,
        hints
    }

    await update(
        ref(getDb(), `users/${wallet}`),
        buildStoredUserRecord(snapshot)
    )
    await remove(
        ref(
            getDb(),
            `users/${wallet}/universal`
        )
    )

    return {
        success: true,
        snapshot
    }
}

export async function completeRevivePurchase(
    walletAddress: string,
    amount: number
) {
    const user =
        await getOrCreateUserSnapshot(
            walletAddress as Address
        )

    const wallet =
        normalizeWalletAddress(
            walletAddress
        )

    const revives =
        user.revives + Math.max(0, amount)

    const snapshot = {
        ...user,
        revives,
        lives: revives
    }

    await update(
        ref(getDb(), `users/${wallet}`),
        buildStoredUserRecord(snapshot)
    )
    await remove(
        ref(
            getDb(),
            `users/${wallet}/universal`
        )
    )

    return {
        success: true,
        snapshot
    }
}
