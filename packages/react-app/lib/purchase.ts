import {
    encodeFunctionData
} from "viem"

import type { Address } from "viem"

import {
    getWallet,
    ensureCeloNetwork,
    getEthereum
} from "./wallet"

export type PaymentToken =
    | "USDT"
    | "USDC"

export type PurchaseKind =
    | "entry"
    | "hint"
    | "revive"

export interface EntryPaymentStatus {
    canPay: boolean
    payCount: bigint
    payCountUSDT: bigint
    payCountUSDC: bigint
}

interface PaymentConfig {
    contractAddress: Address
    tokenContract: Address
    fee: bigint
}

const CONTRACTS: Record<PurchaseKind, Address> = {
    entry: (
        process.env
            .NEXT_PUBLIC_GAME_ENTRY_CONTRACT ||
        "0x0CCba85476Fbd345fd3aD672004DA27083727151"
    ) as Address,
    hint: (
        process.env
            .NEXT_PUBLIC_HINT_PURCHASE_CONTRACT ||
        "0x69c9faF5C9b3A9227c2e1E5312a261103b99933F"
    ) as Address,
    revive: (
        process.env
            .NEXT_PUBLIC_REVIVE_PURCHASE_CONTRACT ||
        "0x2dEf5F5EFC3d44822DDA3dD24D1DEAdEC311Bd8a"
    ) as Address
}

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

const APPROVAL_AMOUNT =
    BigInt("1000000")

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
                name: "value",
                type: "uint256"
            }
        ],
        outputs: [
            {
                type: "bool"
            }
        ]
    },
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
    },
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
] as const

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
] as const

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
    }
] as const

const ENTRY_STATUS_ABI = [
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
] as const

function getContractAddress(
    kind: PurchaseKind
) {
    return CONTRACTS[kind]
}

function getApprovalCacheKey(
    wallet: Address,
    token: PaymentToken,
    tokenContract: Address,
    spenderContract: Address
) {
    return `minipay_approved_${wallet.toLowerCase()}_${token.toLowerCase()}_${tokenContract.toLowerCase()}_${spenderContract.toLowerCase()}`
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

    visited.add(error)

    if (typeof error === "string") {
        const trimmed = error.trim()
        if (trimmed && !parts.includes(trimmed))
            parts.push(trimmed)
        return
    }

    if (error instanceof Error) {
        if (error.message && !parts.includes(error.message))
            parts.push(error.message)

        flattenErrorParts(
            (error as any).cause,
            parts,
            visited
        )
        return
    }

    if (typeof error === "object") {
        const record = error as Record<string, unknown>
        const keys = [
            "message",
            "reason",
            "shortMessage",
            "details",
            "error"
        ]

        for (const key of keys) {
            if (key in record)
                flattenErrorParts(
                    record[key],
                    parts,
                    visited
                )
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
        return "Payment failed because MiniPay could not pull the token amount. Please make sure you have enough balance and approval."
    }

    if (
        lower.includes("rate limit")
    ) {
        return "This wallet already used this payment recently. Please wait before paying again."
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

        await new Promise((resolve) =>
            setTimeout(resolve, 2000)
        )

        attempts++
    }

    throw new Error(
        "Transaction timeout"
    )
}

async function readUint256Call(
    contractAddress: Address,
    abi: readonly any[],
    functionName: string,
    args: any[] = []
) {
    const ethereum = getEthereum()

    if (!ethereum) {
        throw new Error("Wallet missing")
    }

    const result =
        await ethereum.request({
            method: "eth_call",
            params: [
                {
                    to: contractAddress,
                    data: encodeFunctionData({
                        abi,
                        functionName,
                        args
                    })
                },
                "latest"
            ]
        })

    return BigInt(result as string)
}

async function readAddressCall(
    contractAddress: Address,
    functionName: "USDT" | "USDC"
) {
    const ethereum = getEthereum()

    if (!ethereum) {
        throw new Error("Wallet missing")
    }

    const result =
        await ethereum.request({
            method: "eth_call",
            params: [
                {
                    to: contractAddress,
                    data: encodeFunctionData({
                        abi: PAYMENT_CONFIG_ABI,
                        functionName,
                        args: []
                    })
                },
                "latest"
            ]
        })

    return `0x${String(result).slice(-40)}` as Address
}

async function getTokenBalance(
    wallet: Address,
    tokenContract: Address
) {
    const ethereum = getEthereum()

    if (!ethereum) {
        throw new Error("Wallet missing")
    }

    const result =
        await ethereum.request({
            method: "eth_call",
            params: [
                {
                    to: tokenContract,
                    data: encodeFunctionData({
                        abi: ERC20_ABI,
                        functionName: "balanceOf",
                        args: [wallet]
                    })
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
        legacyTokenContract.toLowerCase() ===
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

    const result =
        await ethereum.request({
            method: "eth_call",
            params: [
                {
                    to: tokenContract,
                    data: encodeFunctionData({
                        abi: ERC20_ABI,
                        functionName: "allowance",
                        args: [wallet, spender]
                    })
                },
                "latest"
            ]
        })

    return BigInt(result as string) >= amount
}

async function approveIfNeeded(
    wallet: Address,
    token: PaymentToken,
    tokenContract: Address,
    requiredPaymentAmount: bigint,
    spenderContract: Address
) {
    const cacheKey =
        getApprovalCacheKey(
            wallet,
            token,
            tokenContract,
            spenderContract
        )

    const approved =
        localStorage.getItem(cacheKey)

    if (approved === "true") {
        const stillApproved =
            await hasEnoughAllowance(
                wallet,
                spenderContract,
                requiredPaymentAmount,
                tokenContract
            )

        if (stillApproved) {
            return
        }

        localStorage.removeItem(cacheKey)
    }

    const allowanceApproved =
        await hasEnoughAllowance(
            wallet,
            spenderContract,
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
                spenderContract,
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

async function getPaymentConfig(
    kind: PurchaseKind,
    token: PaymentToken
): Promise<PaymentConfig> {
    const contractAddress =
        getContractAddress(kind)

    const tokenContract =
        token === "USDC"
            ? await readAddressCall(
                contractAddress,
                "USDC"
            )
            : await readAddressCall(
                contractAddress,
                "USDT"
            )

    const fee =
        await readUint256Call(
            contractAddress,
            PAYMENT_CONFIG_ABI,
            "FEE"
        )

    return {
        contractAddress,
        tokenContract,
        fee
    }
}

async function sendPayment(
    token: PaymentToken,
    kind: PurchaseKind
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
                kind,
                token
            )

        console.log(
            "[MiniPay] Payment config",
            {
                contractAddress:
                    paymentConfig.contractAddress,
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
            paymentConfig.fee,
            paymentConfig.contractAddress
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

        const functionName =
            token === "USDC"
                ? "payWithUSDC"
                : "payWithUSDT"

        console.log(
            "[MiniPay] Opening payment popup",
            functionName
        )

        const tx =
            await ethereum.request({
                method: "eth_sendTransaction",
                params: [
                    {
                        from: wallet,
                        to: paymentConfig.contractAddress,
                        data: encodeFunctionData({
                            abi: PAYMENT_ABI,
                            functionName,
                            args: []
                        }),
                        value: "0x0"
                    }
                ]
            })

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
    token: PaymentToken = "USDT",
    kind: PurchaseKind = "entry"
) {
    return await sendPayment(
        token,
        kind
    )
}

export async function getEntryPaymentStatus(
    wallet: Address
): Promise<EntryPaymentStatus> {
    const contractAddress =
        getContractAddress("entry")

    const payCount =
        await readUint256Call(
            contractAddress,
            ENTRY_STATUS_ABI,
            "getPayCount",
            [wallet]
        )

    const payCountUSDT =
        await readUint256Call(
            contractAddress,
            ENTRY_STATUS_ABI,
            "getPayCountUSDT",
            [wallet]
        )

    const payCountUSDC =
        await readUint256Call(
            contractAddress,
            ENTRY_STATUS_ABI,
            "getPayCountUSDC",
            [wallet]
        )

    return {
        canPay:
            payCount === BigInt(0) &&
            payCountUSDT === BigInt(0) &&
            payCountUSDC === BigInt(0),
        payCount,
        payCountUSDT,
        payCountUSDC
    }
}
