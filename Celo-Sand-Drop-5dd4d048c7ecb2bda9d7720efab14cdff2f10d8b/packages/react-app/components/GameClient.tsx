"use client"

import { useEffect } from "react"
import { saveScore, getLeaderboard } from "@/lib/Leaderboard"
import { encodeFunctionData } from "viem"
import { initUser, getUser, consumeChance, addChances, updateUsername } from "@/lib/chances"
import type { Address } from "viem"
const CONTRACT: Address = "0xafFb98DeCfc3e1E7867fA412Bf9580E377bE265a"
const USDT: Address = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e"


export default function Home() {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (typeof window === "undefined") return; // 🚀 CRITICAL FIX
        if (typeof window !== "undefined" && window.ethereum) {
            window.ethereum.request({ method: "eth_accounts" });
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
            const accounts = await window.ethereum.request({
                method: "eth_accounts"
            });

            if (!accounts || accounts.length === 0) {
                throw new Error("Wallet not connected");
            }

            const user = accounts[0];

            // =========================
            // 2. NETWORK CHECK (FAST)
            // =========================
            const chainId = await window.ethereum.request({
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

                console.log("🔥 First-time approval...");

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

                await window.ethereum.request({
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
            const tx = await window.ethereum.request({
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

            console.error("❌ Payment failed:", err);

            sendToUnity("OnPaymentFailed", err?.message || "FAILED");
        }
    }
    

    async function getWallet(): Promise<Address> {
        if (typeof window === "undefined" || !window.ethereum) {
            throw new Error("No wallet found")
        }

        let accounts = await window.ethereum.request({
            method: "eth_accounts"
        })

        if (!accounts || accounts.length === 0) {
            accounts = await window.ethereum.request({
                method: "eth_requestAccounts"
            })
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

    async function handleGetUser() {
        const wallet = await getWallet()
        const data = await getUser(wallet)

        if (!data) {
            console.warn("User not found → reinitializing")

            await handleInitUser({ username: "Guest" })

            const retry = await getUser(wallet)

            sendToUnity("OnUserData", JSON.stringify(retry))
            return
        }

        // ✅ THIS WAS MISSING
        sendToUnity("OnUserData", JSON.stringify(data))
    }


    async function handleUseChance() {
        const wallet = await getWallet()

        const success = await consumeChance(wallet)

        if (!success) {
            sendToUnity("OnChanceUsed", "0")
            return
        }

        // 🔥 GET UPDATED USER DATA
        const updated = await getUser(wallet)

        // 🔥 SEND FULL DATA BACK TO UNITY
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

        await addChances(wallet, CHANCE_REWARD)

        // 🔥 GET UPDATED USER DATA
        const updated = await getUser(wallet)

        // 🔥 SEND FULL DATA
        sendToUnity("OnUserData", JSON.stringify(updated))

        // ✅ NEW
        sendToUnity("OnPurchaseSuccess", "")
    }

    async function buyChancesPayment() {

        if (typeof window === "undefined") return; // ✅ FIX
        try {
            console.log("🔥 Starting Buy Payment");

            const [user] = await window.ethereum.request({
                method: "eth_requestAccounts"
            })

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

                console.log("🔥 First-time BUY approval...");

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

                await window.ethereum.request({
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

            console.log("🔥 Sending Pay TX...");

            const tx = await window.ethereum.request({
                method: "eth_sendTransaction",
                params: [{
                    from: user,
                    to: BUY_CONTRACT,
                    data: payData
                }]
            })

            console.log("🔥 TX SENT:", tx);

            await waitForTx(tx)

            console.log("🔥 PAYMENT SUCCESS");

            return true
        } catch (err: any) {
            console.error("❌ BUY FAILED:", err);

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
            const receipt = await window.ethereum.request({
                method: "eth_getTransactionReceipt",
                params: [txHash]
            });

            if (receipt) return receipt;

            await new Promise(r => setTimeout(r, 2000));
            attempts++;
        }

        throw new Error("Transaction timeout");
    }


    async function handleUpdateUsername(data: any) {
        const wallet = await getWallet()

        await updateUsername(wallet, data.username)

        // 🔥 Send updated data back
        const updated = await getUser(wallet)

        sendToUnity("OnUserData", JSON.stringify(updated))
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

        const result = await window.ethereum.request({
            method: "eth_call",
            params: [{
                to: USDT,
                data
            }, "latest"]
        })

        return BigInt(result) >= amount
    }


    // =========================
    // ?? SAVE SCORE
    // =========================
    async function handleSaveScore(data: any) {
        try {
            const wallet = await getWallet()
            const user = await getUser(wallet)

            if (!user || !user.username) {
                console.error("❌ Username missing from Firebase")
                return
            }

          

            await saveScore(data.gameName, wallet, user.username, data.score)

            console.log("✅ Score saved with Firebase username")

            sendToUnity("OnLeaderboardSaved", "")

        } catch (err: any) {
            console.error("❌ Payment failed:", err);

            sendToUnity("OnPaymentFailed", err?.message || "FAILED")
        }
    }

    // =========================
    // ?? GET LEADERBOARD
    // =========================
    async function handleGetLeaderboard(data: any) {

        try {
            const leaderboard = await getLeaderboard(data.gameName)

            console.log("?? Leaderboard:", leaderboard)

            sendToUnity("OnLeaderboardReceived", JSON.stringify(leaderboard))

        } catch (err) {
            console.log("? Fetch leaderboard failed:", err)
        }
    }

    // =========================
    // ?? SEND BACK TO UNITY
    // =========================
    function sendToUnity(method: string, value: string) {
        if (typeof window === "undefined") return; // ✅ FIX

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
                src="https://pub-9a26c23caef04b618b5b21bbfc1be6b9.r2.dev/public/game/index.html"
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