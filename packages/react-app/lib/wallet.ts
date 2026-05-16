import type { Address } from "viem"

declare global {
    interface Window {
        ethereum?: any
        unityInstance?: any
    }
}

function normalizeChainId(
    chainId: unknown
) {
    if (
        typeof chainId !== "string" &&
        typeof chainId !== "number"
    ) {
        return ""
    }

    return String(chainId)
        .trim()
        .toLowerCase()
}

function tryGetFrameEthereum(
    target: Window | null | undefined
) {
    if (!target)
        return null

    try {
        return (target as any).ethereum || null
    } catch {
        return null
    }
}

export function getEthereum() {
    if (typeof window === "undefined")
        return null

    return (
        tryGetFrameEthereum(window) ||
        tryGetFrameEthereum(window.parent) ||
        tryGetFrameEthereum(window.top)
    )
}

export async function getWallet(): Promise<Address> {
    const ethereum = getEthereum()

    if (!ethereum) {
        throw new Error("MiniPay wallet not found")
    }

    let accounts =
        await ethereum.request({
            method: "eth_accounts"
        })

    if (!accounts || accounts.length === 0) {
        accounts =
            await ethereum.request({
                method: "eth_requestAccounts"
            })
    }

    if (!accounts || accounts.length === 0) {
        throw new Error("No wallet connected")
    }

    return accounts[0]
}

export async function getWalletSafe(): Promise<Address | null> {
    try {
        const ethereum = getEthereum()

        if (!ethereum) return null

        const accounts = await ethereum.request({
            method: "eth_accounts"
        })

        if (!accounts || accounts.length === 0) {
            return null
        }

        return accounts[0]
    } catch {
        return null
    }
}

export async function getChainId(): Promise<string> {
    const ethereum = getEthereum()

    if (!ethereum) {
        throw new Error("No wallet")
    }

    return await ethereum.request({
        method: "eth_chainId"
    })
}

export async function ensureCeloNetwork() {
    const chainId = await getChainId()
    const normalized =
        normalizeChainId(chainId)

    if (
        normalized !== "0xa4ec" &&
        normalized !== "42220"
    ) {
        throw new Error("Wrong network")
    }
}
