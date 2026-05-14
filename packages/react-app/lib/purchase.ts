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
    getChallengeProgress,
    addChallengeChances
} from "./challenge"

import {
    getClassicProgress
} from "./classic"

import {
    ref,
    update,
    get,
    set
} from "firebase/database"

import { db } from "./firebase"
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

    await update(
        ref(db, `users/${wallet}`),
        {
            hasPurchasedGame: true
        }
    )

    return {
        success: true
    }
}

export async function purchaseHints(
    amount: number,
    token: PaymentToken = "USDT"
) {
    const wallet = await sendPayment(token)

    const snapshot = await get(
        ref(db, `users/${wallet}`)
    )

    const user =
        snapshot.exists()
            ? snapshot.val()
            : {}

    const hints =
        (user.hints || 0) + amount

    await update(
        ref(db, `users/${wallet}`),
        {
            hints
        }
    )

    return {
        success: true,
        hints
    }
}

export async function purchaseLives(
    amount: number,
    token: PaymentToken = "USDT"
) {
    const wallet = await sendPayment(token)

    const snapshot = await get(
        ref(db, `users/${wallet}`)
    )

    const user =
        snapshot.exists()
            ? snapshot.val()
            : {}

    const lives =
        (user.lives || 0) + amount

    await update(
        ref(db, `users/${wallet}`),
        {
            lives
        }
    )

    return {
        success: true,
        lives
    }
}