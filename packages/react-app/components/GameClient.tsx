"use client"
import { useEffect, useRef } from "react"
import { saveScore, getLeaderboard } from "@/lib/Leaderboard"
import { encodeFunctionData } from "viem"
import { initUser, getUser, consumeChance, addChances, updateUsername } from "@/lib/chances"
import type { Address } from "viem"
const CONTRACT: Address = "0xafFb98DeCfc3e1E7867fA412Bf9580E377bE265a"
const USDT: Address = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e"


export default function Home() {

    const userLoaded = useRef(false)

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        const preload = async () => {
            try {
                await handleGetUser()
            } catch (e) {
                console.log("Preload failed:", e)
            }
        }

        preload()

    }, [])

    useEffect(() => {
        const ethereum = getEthereum()
        if (ethereum) {
            ethereum.request({ method: "eth_accounts" })
        }
    }, [])
    function getEthereum() {
        if (typeof window === "undefined") return null
        return (window as any).ethereum
    }

    function getNextMidnight() {
        const d = new Date()
        d.setHours(24, 0, 0, 0)
        return d.getTime()
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (typeof window === "undefined") return; // 🚀 CRITICAL FIX
        const ethereum = getEthereum()
        if (ethereum) {
            ethereum.request({ method: "eth_accounts" })
        }

        const handleUnityMessage = async (event: any) => {
            const data = event.data
            if (!data) return

            switch (data.type) {
                case "UNITY_PAY_ENTRY":
                    await handlePayment()
                    break
                case "UNITY_SAVE_SCORE":
                    await handleSaveScore(data)
                    break
                case "UNITY_GET_LEADERBOARD":
                    await handleGetLeaderboard(data)
                    break
                case "UNITY_INIT_USER":
                    await handleInitUser(data)
                    break
                case "UNITY_GET_USER":
                    await handleGetUser()
                    break
                case "UNITY_USE_CHANCE":
                    await handleUseChance()
                    break
                case "UNITY_BUY_CHANCES":
                    await handleBuyChances()
                    break
                case "UNITY_UPDATE_USERNAME":
                    await handleUpdateUsername(data)
                    break
            }
        }

        window.addEventListener("message", handleUnityMessage)

        return () => {
            window.removeEventListener("message", handleUnityMessage)
        }

    }, [])
    
    // =========================
    // ?? PAYMENT FUNCTION
    // =========================
    async function handlePayment() {

        if (typeof window === "undefined") return;

        try {
            // =========================
            // 1. GET WALLET (NO POPUP DELAY)
            // =========================
            const ethereum = getEthereum()
            if (!ethereum) return

            const accounts = await ethereum.request({
                method: "eth_accounts"
            }) as Address[]

            if (!accounts || accounts.length === 0) {
                throw new Error("Wallet not connected");
            }

            const user = accounts[0];

            // =========================
            // 2. NETWORK CHECK (FAST)
            // =========================
            const chainId = await ethereum.request({
                method: "eth_chainId"
            });

            if (chainId !== "0xa4ec") {
                sendToUnity("OnPaymentFailed", "Wrong network");
                return;
            }

            // =========================
            // 3. CHECK ALLOWANCE (🔥 KEY SPEED BOOST)
            // =========================
            const requiredAmount = BigInt(100000);

            // 🔥 CHECK LOCAL CACHE FIRST
            const alreadyApproved = localStorage.getItem("approved_" + user);

            let approved = false;

            if (alreadyApproved === "true") {
                approved = true;
            } else {
                approved = await hasEnoughAllowance(
                    user,
                    CONTRACT,
                    requiredAmount
                );
            }

            // 🔥 IF NOT APPROVED → DO APPROVE ONCE
            if (!approved) {

               

                const approveData = encodeFunctionData({
                    abi: [{
                        name: "approve",
                        type: "function",
                        stateMutability: "nonpayable",
                        inputs: [
                            { name: "spender", type: "address" },
                            { name: "amount", type: "uint256" }
                        ],
                        outputs: []
                    }],
                    functionName: "approve",
                    args: [CONTRACT, BigInt("990000")] // unlimited
                });

                await ethereum.request({
                    method: "eth_sendTransaction",
                    params: [{
                        from: user,
                        to: USDT,
                        data: approveData
                    }]
                });

                // 🔥 SAVE APPROVAL
                localStorage.setItem("approved_" + user, "true");
            }

            // =========================
            // 4. PREPARE PAYMENT DATA (FAST)
            // =========================
            const payData = encodeFunctionData({
                abi: [{
                    name: "pay",
                    type: "function",
                    stateMutability: "nonpayable",
                    inputs: [],
                    outputs: []
                }],
                functionName: "pay",
                args: []
            });

            // =========================
            // 5. 🚀 TRIGGER POPUP ASAP
            // =========================
            const tx = await ethereum.request({
                method: "eth_sendTransaction",
                params: [{
                    from: user,
                    to: CONTRACT,
                    data: payData
                }]
            });

            // =========================
            // 6. WAIT AFTER POPUP (NOT BEFORE)
            // =========================
            await waitForTx(tx);

            // =========================
            // 7. SUCCESS
            // =========================
            sendToUnity("OnPaymentSuccess", "");

        } catch (err: any) {

            

            sendToUnity("OnPaymentFailed", err?.message || "FAILED");
        }
    }
    

    async function getWallet(): Promise<Address> {
        if (typeof window === "undefined" || !window.ethereum) {
            throw new Error("No wallet found")
        }

        let accounts = await window.ethereum.request({
            method: "eth_accounts"
        }) as Address[] | undefined

        if (!accounts || accounts.length === 0) {
            accounts = await window.ethereum.request({
                method: "eth_requestAccounts"
            }) as Address[] | undefined
        }

        if (!accounts || accounts.length === 0) {
            throw new Error("No account connected")
        }

        return accounts[0] as Address
    }

    async function handleInitUser(data: any) {
        const wallet = await getWallet()
        await initUser(wallet, data.username)
    }


    async function getWalletSafe(): Promise<Address | null> {
        if (typeof window === "undefined" || !(window as any).ethereum) {
            return null
        }

        try {
            const accounts = await (window as any).ethereum.request({
                method: "eth_accounts"
            })

            if (!accounts || accounts.length === 0) {
                return null // 🚀 DO NOT BLOCK
            }

            return accounts[0]
        } catch {
            return null
        }
    }

    async function handleGetUser() {
        await waitForUnityReady()

        const wallet = await getWalletSafe()

        // 🚀 ALWAYS RESPOND — NEVER BLOCK UNITY
        if (!wallet) {
            sendToUnity("OnUserData", JSON.stringify({
                username: localStorage.getItem("username") || "Guest",
                chances: 1,
                nextReset: getNextMidnight()
            }))
            return
        }

        let data = await getUser(wallet)

        if (!data) {
            await fetch("/api/initUser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    wallet,
                    username: localStorage.getItem("username") || "Guest"
                })
            })

            data = await getUser(wallet)
        }

        // 🚀 ALWAYS SEND
        sendToUnity("OnUserData", JSON.stringify(data))
    }


    async function handleUseChance() {
        const wallet = await getWallet()

        const updated = await consumeChance(wallet)

        if (!updated) {
            sendToUnity("OnChanceUsed", "0")
            return
        }

        // ✅ IMMEDIATE SUCCESS SIGNAL
        sendToUnity("OnChanceUsed", "1")

        sendToUnity("OnUserData", JSON.stringify(updated))
    }

    const BUY_CONTRACT: Address = "0xa4303482605aAEB0bAC78F184f2f132D5e8A132F"
    const CHANCE_REWARD = 3
    const BUY_ABI = [
        {
            inputs: [],
            name: "pay",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function"
        }
    ]

    async function handleBuyChances() {
        const success = await buyChancesPayment()
        if (!success) return

        const wallet = await getWallet()
        const result = await addChances(wallet, CHANCE_REWARD)

        if (!result?.success) {
            sendToUnity("OnPurchaseFailed", result?.error || "FAILED")
            return
        }

        // 🔥 SEND FULL DATA
        sendToUnity("OnUserData", JSON.stringify(result.user))

        // ✅ NEW
        sendToUnity("OnPurchaseSuccess", "")
    }

    async function buyChancesPayment(): Promise<boolean> {

        if (typeof window === "undefined") return false; // ✅ FIX

        try {
           

            const ethereum = getEthereum()
            if (!ethereum) return false

            const accounts = await ethereum.request({
                method: "eth_requestAccounts"
            }) as Address[]

            if (!accounts || accounts.length === 0) {
                throw new Error("No account")
            }

            const user = accounts[0]

            // =========================
            // STEP 1: APPROVE (FIX)
            // =========================
            const requiredAmount = BigInt(100000);

            // 🔥 CACHE CHECK
            const alreadyApproved = localStorage.getItem("approved_buy_" + user);

            let approved = false;

            if (alreadyApproved === "true") {
                approved = true;
            } else {
                approved = await hasEnoughAllowance(
                    user as Address,
                    BUY_CONTRACT as Address,
                    requiredAmount
                );
            }

            if (!approved) {

                

                const approveData = encodeFunctionData({
                    abi: [{
                        name: "approve",
                        type: "function",
                        stateMutability: "nonpayable",
                        inputs: [
                            { name: "spender", type: "address" },
                            { name: "amount", type: "uint256" }
                        ],
                        outputs: []
                    }],
                    functionName: "approve",
                    args: [BUY_CONTRACT, BigInt("990000")]
                });

                await ethereum.request({
                    method: "eth_sendTransaction",
                    params: [{
                        from: user,
                        to: USDT,
                        data: approveData
                    }]
                });

                localStorage.setItem("approved_buy_" + user, "true");
            }

          

            // =========================
            // STEP 2: PAY
            // =========================
            const payData = encodeFunctionData({
                abi: BUY_ABI,
                functionName: "pay",
                args: []
            })

           

            const tx = await ethereum.request({
                method: "eth_sendTransaction",
                params: [{
                    from: user,
                    to: BUY_CONTRACT,
                    data: payData
                }]
            })

            

            await waitForTx(tx)

           

            return true
        } catch (err: any) {
          

            // 🔥 SEND FAILURE TO UNITY
            sendToUnity("OnPurchaseFailed", err?.message || "FAILED")

            return false
        }
    }

    async function waitForTx(txHash: string) {
        if (typeof window === "undefined") return;

        let attempts = 0;
        const maxAttempts = 30; // ⛔ prevent infinite loop

        while (attempts < maxAttempts) {
            const ethereum = getEthereum()
            if (!ethereum) throw new Error("No wallet")

            const receipt = await ethereum.request({
                method: "eth_getTransactionReceipt",
                params: [txHash]
            })

            if (receipt) return receipt;

            await new Promise(r => setTimeout(r, 2000));
            attempts++;
        }

        throw new Error("Transaction timeout");
    }

    async function handleUpdateUsername(data: any) {
        const wallet = await getWallet()

        const result = await updateUsername(wallet, data.username)

        // 🔥 SAVE LOCALLY (CRITICAL)
        localStorage.setItem("username", data.username)

        sendToUnity("OnUserData", JSON.stringify(result?.user))
    }


    async function hasEnoughAllowance(
        user: Address,
        spender: Address,
        amount: bigint
    ) {
        const data = encodeFunctionData({
            abi: [{
                name: "allowance",
                type: "function",
                stateMutability: "view",
                inputs: [
                    { name: "owner", type: "address" },
                    { name: "spender", type: "address" }
                ],
                outputs: [{ type: "uint256" }]
            }],
            functionName: "allowance",
            args: [user, spender]
        })

        const ethereum = getEthereum()
        if (!ethereum) throw new Error("No wallet")

        const result = await ethereum.request({
            method: "eth_call",
            params: [{
                to: USDT,
                data
            }, "latest"]
        })

        return BigInt(result as string) >= amount
    }


    // =========================
    // ?? SAVE SCORE
    // =========================
    async function handleSaveScore(data: any) {
        try {
            const wallet = await getWallet()
            const user = await getUser(wallet)

            if (!user || !user.username) {
               
                return
            }

          

            await fetch("/api/saveScore", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    gameName: data.gameName,
                    wallet,
                    username: user.username,
                    score: data.score
                })
            })

            

            sendToUnity("OnLeaderboardSaved", "")

        } catch (err: any) {
           

            sendToUnity("OnPaymentFailed", err?.message || "FAILED")
        }
    }

    // =========================
    // ?? GET LEADERBOARD
    // =========================
    async function handleGetLeaderboard(data: any) {

        try {
            const leaderboard = await getLeaderboard(data.gameName)

           

            sendToUnity("OnLeaderboardReceived", JSON.stringify(leaderboard))

        } catch (err) {
           
        }
    }
    let unityReady = false

    function waitForUnityReady(): Promise<void> {
        return new Promise((resolve) => {
            const check = () => {
                const iframe: any = document.querySelector("iframe")
                if (iframe && iframe.contentWindow) {
                    unityReady = true
                    resolve()
                } else {
                    setTimeout(check, 100)
                }
            }
            check()
        })
    }

    // =========================
    // ?? SEND BACK TO UNITY
    // =========================
    async function sendToUnity(method: string, value: string) {
        if (!unityReady) {
            await waitForUnityReady()
        }

        const iframe: any = document.querySelector("iframe")

        iframe?.contentWindow?.postMessage({
            type: "UNITY_CALLBACK",
            method,
            value
        }, "*")
    }

    // =========================
    // UI
    // =========================
    return (
        <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            overflow: "hidden"
        }}>
            <iframe
                src="https://pub-2d8ab9d45264407c872726510fb72802.r2.dev/public/game/index.html"
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
