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
    set
} from "firebase/database"

import { getDb } from "./firebase"
import type {
    UserSnapshot
} from "./types"

export type PaymentToken =
    | "USDT"
    | "USDC"
const GAME_CONTRACT =
    "0xd9a8665a4Bb8cde69Ba478F39924891D6e977eB7"

const USDT_CONTRACT: Address =
    "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e"

const GAME_PRICE = BigInt(500000)

const HINT_PRICE = BigInt(990000)

const LIVES_PRICE = BigInt(1990000)

function buildDefaultUserSnapshot(
    walletAddress: string
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
        universal: {
            weeklyChallengeCycleIndex: 0,
            weeklyChallengeEndUnixMilliseconds: 0
        }
    }
}

function mergeSnapshot(
    walletAddress: string,
    raw: any
): UserSnapshot {
    const base =
        buildDefaultUserSnapshot(
            walletAddress
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
        universal: {
            weeklyChallengeCycleIndex:
                Number(
                    raw?.universal?.weeklyChallengeCycleIndex ??
                    base.universal.weeklyChallengeCycleIndex
                ),
            weeklyChallengeEndUnixMilliseconds:
                Number(
                    raw?.universal?.weeklyChallengeEndUnixMilliseconds ??
                    base.universal.weeklyChallengeEndUnixMilliseconds
                )
        }
    }
}

async function getOrCreateUserSnapshot(
    wallet: Address
) {
    const userRef =
        ref(
            getDb(),
            `users/${wallet}`
        )

    const snapshot =
        await get(userRef)

    if (!snapshot.exists()) {
        const user =
            buildDefaultUserSnapshot(wallet)

        await set(userRef, user)
        return user
    }

    const user =
        mergeSnapshot(
            wallet,
            snapshot.val()
        )

    await set(
        userRef,
        user
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

async function sendPayment(
    token: PaymentToken
) {
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
}

export async function purchaseGame(
    token: PaymentToken = "USDT"
) {
    const wallet = await sendPayment(token)

    const user =
        await getOrCreateUserSnapshot(wallet)

    const snapshot = {
        ...user,
        hasPurchasedGame: true
    }

    await update(
        ref(getDb(), `users/${wallet}`),
        snapshot
    )

    return {
        success: true,
        snapshot
    }
}

export async function purchaseHints(
    amount: number,
    token: PaymentToken = "USDT"
) {
    const wallet = await sendPayment(token)

    const user =
        await getOrCreateUserSnapshot(wallet)

    const hints =
        user.hints + amount

    const snapshot = {
        ...user,
        hints
    }

    await update(
        ref(getDb(), `users/${wallet}`),
        snapshot
    )

    return {
        success: true,
        snapshot
    }
}

export async function purchaseLives(
    amount: number,
    token: PaymentToken = "USDT"
) {
    const wallet = await sendPayment(token)

    const user =
        await getOrCreateUserSnapshot(wallet)

    const revives =
        user.revives + amount

    const snapshot = {
        ...user,
        revives,
        lives: revives
    }

    await update(
        ref(getDb(), `users/${wallet}`),
        snapshot
    )

    return {
        success: true,
        snapshot
    }
}
