import type { Address } from "viem"

declare global {
    interface Window {
        ethereum?: any
        unityInstance?: any
    }
}

export function getEthereum() {
    if (typeof window === "undefined") return null
    return window.ethereum
}

export async function getWallet(): Promise<Address> {
    const ethereum = getEthereum()

    if (!ethereum) {
        throw new Error("MiniPay wallet not found")
    }

    const accounts = await ethereum.request({
        method: "eth_requestAccounts"
    })

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

    if (chainId !== "0xa4ec") {
        throw new Error("Wrong network")
    }
}