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
const GAME_CONTRACT: Address =
    (
        process.env
            .NEXT_PUBLIC_GAME_ENTRY_CONTRACT ||
        "0x927864875719A2357ADf3be81df7ccA1779dCAE6"
    ) as Address

const FALLBACK_USDT_CONTRACT: Address =
    (
        process.env
            .NEXT_PUBLIC_USDT_CONTRACT ||
        "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e"
    ) as Address

const FALLBACK_USDC_CONTRACT: Address =
    (
        process.env
            .NEXT_PUBLIC_USDC_CONTRACT ||
        "0x37f750B7cC259a2f741Af45294f6a16572CF5cAd"
    ) as Address

const DEFAULT_UNIVERSAL: UniversalProgress = {
    weeklyChallengeCycleIndex: 0,
    weeklyChallengeEndUnixMilliseconds: 0
}

const FREE_UNLOCK_HINT_REWARD = 5
const APPROVAL_AMOUNT =
    BigInt("1000000")

function normalizeWalletAddress(
    walletAddress: string
) {
    return walletAddress.trim()
}

function getApprovalCacheKey(
    wallet: Address,
    token: PaymentToken,
    tokenContract: Address
) {
    return `minipay_approved_${wallet.toLowerCase()}_${token.toLowerCase()}_${tokenContract.toLowerCase()}`
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
        name: "pay",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [],
        outputs: []
    },

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

const PAYMENT_CONFIG_ABI = [
    {
        name: "USDT",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [
            {
                type: "address"
            }
        ]
    },
    {
        name: "USDC",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [
            {
                type: "address"
            }
        ]
    },
    {
        name: "FEE",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [
            {
                type: "uint256"
            }
        ]
    },
    {
        name: "canPay",
        type: "function",
        stateMutability: "view",
        inputs: [
            {
                name: "user",
                type: "address"
            }
        ],
        outputs: [
            {
                type: "bool"
            }
        ]
    },
    {
        name: "secondsUntilCanPay",
        type: "function",
        stateMutability: "view",
        inputs: [
            {
                name: "player",
                type: "address"
            }
        ],
        outputs: [
            {
                type: "uint256"
            }
        ]
    },
    {
        name: "getPayCount",
        type: "function",
        stateMutability: "view",
        inputs: [
            {
                name: "player",
                type: "address"
            }
        ],
        outputs: [
            {
                type: "uint256"
            }
        ]
    },
    {
        name: "getPayCountUSDT",
        type: "function",
        stateMutability: "view",
        inputs: [
            {
                name: "player",
                type: "address"
            }
        ],
        outputs: [
            {
                type: "uint256"
            }
        ]
    },
    {
        name: "getPayCountUSDC",
        type: "function",
        stateMutability: "view",
        inputs: [
            {
                name: "player",
                type: "address"
            }
        ],
        outputs: [
            {
                type: "uint256"
            }
        ]
    }
]

type PaymentConfig = {
    fee: bigint
    tokenContract: Address
}

export type EntryPaymentStatus = {
    canPay: boolean
    secondsUntilCanPay: bigint
    payCount: bigint
    payCountUSDT: bigint
    payCountUSDC: bigint
}

function flattenErrorParts(
    error: unknown,
    parts: string[],
    visited = new Set<unknown>()
) {
    if (
        error === null ||
        error === undefined ||
        visited.has(error)
    ) {
        return
    }

    if (
        typeof error === "string" ||
        typeof error === "number" ||
        typeof error === "boolean"
    ) {
        const value =
            String(error).trim()

        if (
            value &&
            !parts.includes(value)
        ) {
            parts.push(value)
        }

        return
    }

    if (error instanceof Error) {
        visited.add(error)
        flattenErrorParts(
            error.message,
            parts,
            visited
        )

        const extraError =
            error as Error & {
                cause?: unknown
            }

        if (
            extraError.cause !== undefined
        ) {
            flattenErrorParts(
                extraError.cause,
                parts,
                visited
            )
        }

        return
    }

    if (typeof error === "object") {
        visited.add(error)

        const record =
            error as Record<
                string,
                unknown
            >

        const prioritizedKeys = [
            "message",
            "shortMessage",
            "reason",
            "details",
            "error",
            "data",
            "cause"
        ]

        for (const key of prioritizedKeys) {
            if (
                key in record &&
                record[key] !== undefined
            ) {
                flattenErrorParts(
                    record[key],
                    parts,
                    visited
                )
            }
        }

        if (
            "code" in record &&
            record.code !== undefined
        ) {
            const codeValue =
                `code ${String(record.code).trim()}`

            if (
                codeValue &&
                !parts.includes(codeValue)
            ) {
                parts.push(codeValue)
            }
        }

        try {
            const json =
                JSON.stringify(error)

            if (
                json &&
                json !== "{}" &&
                !parts.includes(json)
            ) {
                parts.push(json)
            }
        } catch {
        }
    }
}

function extractErrorMessage(
    error: unknown
) {
    const parts: string[] = []
    flattenErrorParts(
        error,
        parts
    )

    return parts.length > 0
        ? parts.join(" | ")
        : "Payment failed"
}

function shouldFallbackToLegacyPay(
    error: unknown
) {
    const lower =
        extractErrorMessage(error)
            .toLowerCase()

    if (
        lower.includes("cancel") ||
        lower.includes("rejected") ||
        lower.includes("denied") ||
        lower.includes("insufficient")
    ) {
        return false
    }

    return (
        lower.includes("execution reverted") ||
        lower.includes("revert") ||
        lower.includes("selector") ||
        lower.includes("not recognized") ||
        lower.includes("method") ||
        lower.includes("unsupported") ||
        lower.includes("invalid") ||
        lower.includes("[object object]") ||
        lower.includes("code -32603")
    )
}

function getPaymentMethodCandidates(
    token: PaymentToken
) {
    return token === "USDC"
        ? ["payWithUSDC", "pay"] as const
        : ["payWithUSDT", "pay"] as const
}

async function getPaymentConfig(
    token: PaymentToken,
    wallet: Address
): Promise<PaymentConfig> {
    const ethereum = getEthereum()

    if (!ethereum) {
        throw new Error("Wallet missing")
    }

    let tokenContract: Address =
        token === "USDC"
            ? FALLBACK_USDC_CONTRACT
            : FALLBACK_USDT_CONTRACT

    let fee = BigInt("500000")

    try {
        const contractToken =
            await ethereum.request({
                method: "eth_call",
                params: [
                    {
                        to: GAME_CONTRACT,
                        data: encodeFunctionData(
                            {
                                abi: PAYMENT_CONFIG_ABI,
                                functionName:
                                    token,
                                args: []
                            }
                        )
                    },
                    "latest"
                ]
            })

        if (
            typeof contractToken ===
            "string" &&
            contractToken.length >= 42
        ) {
            tokenContract =
                (`0x${contractToken.slice(-40)}` as Address)
        }
    } catch {
    }

    try {
        const feeResult =
            await ethereum.request({
                method: "eth_call",
                params: [
                    {
                        to: GAME_CONTRACT,
                        data: encodeFunctionData(
                            {
                                abi: PAYMENT_CONFIG_ABI,
                                functionName:
                                    "FEE",
                                args: []
                            }
                        )
                    },
                    "latest"
                ]
            })

        if (typeof feeResult === "string") {
            fee = BigInt(feeResult)
        }
    } catch {
    }

    try {
        const canPayResult =
            await ethereum.request({
                method: "eth_call",
                params: [
                    {
                        to: GAME_CONTRACT,
                        data: encodeFunctionData(
                            {
                                abi: PAYMENT_CONFIG_ABI,
                                functionName:
                                    "canPay",
                                args: [wallet]
                            }
                        )
                    },
                    "latest"
                ]
            })

        console.log(
            "[MiniPay] canPay",
            canPayResult
        )
    } catch {
    }

    return {
        fee,
        tokenContract
    }
}

export async function getEntryPaymentStatus(
    wallet: Address
): Promise<EntryPaymentStatus> {
    const ethereum = getEthereum()

    if (!ethereum) {
        throw new Error("Wallet missing")
    }

    async function readUint(
        functionName:
            | "secondsUntilCanPay"
            | "getPayCount"
            | "getPayCountUSDT"
            | "getPayCountUSDC"
    ) {
        const result =
            await ethereum.request({
                method: "eth_call",
                params: [
                    {
                        to: GAME_CONTRACT,
                        data: encodeFunctionData(
                            {
                                abi: PAYMENT_CONFIG_ABI,
                                functionName,
                                args: [wallet]
                            }
                        )
                    },
                    "latest"
                ]
            })

        return BigInt(
            result as string
        )
    }

    const canPayResult =
        await ethereum.request({
            method: "eth_call",
            params: [
                {
                    to: GAME_CONTRACT,
                    data: encodeFunctionData(
                        {
                            abi: PAYMENT_CONFIG_ABI,
                            functionName:
                                "canPay",
                            args: [wallet]
                        }
                    )
                },
                "latest"
            ]
        })

    return {
        canPay:
            BigInt(
                canPayResult as string
            ) !== BigInt(0),
        secondsUntilCanPay:
            await readUint(
                "secondsUntilCanPay"
            ),
        payCount:
            await readUint(
                "getPayCount"
            ),
        payCountUSDT:
            await readUint(
                "getPayCountUSDT"
            ),
        payCountUSDC:
            await readUint(
                "getPayCountUSDC"
            )
    }
}

async function waitForTransaction(
    txHash: string
) {
    const ethereum = getEthereum()

    if (!ethereum) {
        throw new Error("Wallet missing")
    }

    let attempts = 0
    const maxAttempts = 30

    while (attempts < maxAttempts) {
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

        attempts++
    }

    throw new Error(
        "Transaction timeout"
    )
}

async function hasEnoughAllowance(
    wallet: Address,
    spender: Address,
    amount: bigint,
    tokenContract: Address
) {
    const ethereum = getEthereum()

    if (!ethereum) {
        throw new Error("Wallet missing")
    }

    const allowanceAbi = [
        {
            name: "allowance",
            type: "function",
            stateMutability: "view",
            inputs: [
                {
                    name: "owner",
                    type: "address"
                },
                {
                    name: "spender",
                    type: "address"
                }
            ],
            outputs: [
                {
                    type: "uint256"
                }
            ]
        }
    ]

    const data =
        encodeFunctionData({
            abi: allowanceAbi,
            functionName:
                "allowance",
            args: [
                wallet,
                spender
            ]
        })

    const result =
        await ethereum.request({
            method: "eth_call",
            params: [
                {
                    to: tokenContract,
                    data
                },
                "latest"
            ]
        })

    return BigInt(result as string) >= amount
}

async function getTokenBalance(
    wallet: Address,
    tokenContract: Address
) {
    const ethereum = getEthereum()

    if (!ethereum) {
        throw new Error("Wallet missing")
    }

    const balanceAbi = [
        {
            name: "balanceOf",
            type: "function",
            stateMutability: "view",
            inputs: [
                {
                    name: "account",
                    type: "address"
                }
            ],
            outputs: [
                {
                    type: "uint256"
                }
            ]
        }
    ]

    const data =
        encodeFunctionData({
            abi: balanceAbi,
            functionName:
                "balanceOf",
            args: [wallet]
        })

    const result =
        await ethereum.request({
            method: "eth_call",
            params: [
                {
                    to: tokenContract,
                    data
                },
                "latest"
            ]
        })

    return BigInt(result as string)
}

async function getLegacyTokenBalance(
    wallet: Address,
    token: PaymentToken,
    currentTokenContract: Address
) {
    const legacyTokenContract =
        token === "USDC"
            ? FALLBACK_USDC_CONTRACT
            : FALLBACK_USDT_CONTRACT

    if (
        legacyTokenContract
            .toLowerCase() ===
        currentTokenContract.toLowerCase()
    ) {
        return BigInt(0)
    }

    try {
        return await getTokenBalance(
            wallet,
            legacyTokenContract
        )
    } catch {
        return BigInt(0)
    }
}

async function approveIfNeeded(
    wallet: Address,
    token: PaymentToken,
    tokenContract: Address,
    requiredPaymentAmount: bigint
) {
    const cacheKey =
        getApprovalCacheKey(
            wallet,
            token,
            tokenContract
        )

    const approved =
        localStorage.getItem(cacheKey)

    if (approved === "true") {
        const stillApproved =
            await hasEnoughAllowance(
                wallet,
                GAME_CONTRACT as Address,
                requiredPaymentAmount,
                tokenContract
            )

        if (stillApproved) {
            return
        }

        localStorage.removeItem(
            cacheKey
        )
    }

    const allowanceApproved =
        await hasEnoughAllowance(
            wallet,
            GAME_CONTRACT as Address,
            requiredPaymentAmount,
            tokenContract
        )

    if (allowanceApproved) {
        localStorage.setItem(
            cacheKey,
            "true"
        )
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
                APPROVAL_AMOUNT
            ]
        })

    const tx =
        await ethereum.request({
            method: "eth_sendTransaction",
            params: [
                {
                    from: wallet,
                    to: tokenContract,
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
        extractErrorMessage(error)

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
        lower.includes("transferfrom failed") ||
        lower.includes("payment from failed")
    ) {
        return "Payment failed because MiniPay could not pull the USDT amount. Please make sure you have enough USDT balance and approval."
    }

    if (
        lower.includes("no celo accepted")
    ) {
        return "This payment route rejected the fallback CELO path. Retrying with the token payment route is required."
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
        console.log(
            "[MiniPay] Purchase requested",
            token
        )

        const wallet = await getWallet()

        console.log(
            "[MiniPay] Wallet ready",
            wallet
        )

        await ensureCeloNetwork()

        console.log(
            "[MiniPay] Network confirmed"
        )

        const paymentConfig =
            await getPaymentConfig(
                token,
                wallet
            )

        console.log(
            "[MiniPay] Payment config",
            {
                tokenContract:
                    paymentConfig.tokenContract,
                fee:
                    paymentConfig.fee.toString()
            }
        )

        await approveIfNeeded(
            wallet,
            token,
            paymentConfig.tokenContract,
            paymentConfig.fee
        )

        console.log(
            "[MiniPay] Approval confirmed"
        )

        const tokenBalance =
            await getTokenBalance(
                wallet,
                paymentConfig.tokenContract
            )

        console.log(
            `[MiniPay] ${token} balance`,
            tokenBalance.toString()
        )

        if (
            tokenBalance <
                paymentConfig.fee
        ) {
            const legacyTokenBalance =
                await getLegacyTokenBalance(
                    wallet,
                    token,
                    paymentConfig.tokenContract
                )

            if (
                legacyTokenBalance >=
                paymentConfig.fee
            ) {
                throw new Error(
                    `Your wallet has ${token} on a different token contract. This game contract expects ${paymentConfig.tokenContract}, but your available balance is on ${token === "USDC" ? FALLBACK_USDC_CONTRACT : FALLBACK_USDT_CONTRACT}.`
                )
            }

            throw new Error(
                `Payment failed due to insufficient ${token} balance.`
            )
        }

        const ethereum = getEthereum()

        if (!ethereum) {
            throw new Error("Wallet missing")
        }

        let paymentData:
            | `0x${string}`
            | null = null

        let tx: string | null =
            null
        const methodCandidates =
            getPaymentMethodCandidates(
                token
            )

        for (
            let index = 0;
            index < methodCandidates.length;
            index++
        ) {
            const methodName =
                methodCandidates[index]

            paymentData =
                encodeFunctionData({
                    abi: PAYMENT_ABI,
                    functionName:
                        methodName,
                    args: []
                })

            console.log(
                "[MiniPay] Opening payment popup",
                methodName
            )

            try {
                tx =
                    await ethereum.request({
                        method: "eth_sendTransaction",
                        params: [
                            {
                                from: wallet,
                                to: GAME_CONTRACT,
                                data: paymentData,
                                value: "0x0"
                            }
                        ]
                    })

                break
            } catch (error) {
                console.error(
                    "[MiniPay] Payment method failed",
                    methodName,
                    error
                )

                const canFallback =
                    methodName !== "pay" &&
                    index <
                        methodCandidates.length - 1 &&
                    shouldFallbackToLegacyPay(
                        error
                    )

                if (!canFallback) {
                    throw error
                }
            }
        }

        if (!tx) {
            throw new Error(
                "MiniPay could not open the payment popup."
            )
        }

        await waitForTransaction(tx)

        console.log(
            "[MiniPay] Payment confirmed",
            tx
        )

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
        hasPurchasedGame: true,
        hints:
            user.hasPurchasedGame
                ? user.hints
                : user.hints + FREE_UNLOCK_HINT_REWARD
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
