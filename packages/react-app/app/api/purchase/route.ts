import { NextResponse } from "next/server"

import {
  completeGamePurchase,
  completeHintPurchase,
  completeRevivePurchase
} from "@/lib/server-user-state"

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json()

    const action =
      body.action

    const walletAddress =
      typeof body.walletAddress === "string"
        ? body.walletAddress.trim()
        : ""

    if (!walletAddress) {
      return NextResponse.json(
        {
          success: false,
          error: "Wallet missing"
        },
        {
          status: 400
        }
      )
    }

    if (action === "game") {
      const result =
        await completeGamePurchase(walletAddress)

      return NextResponse.json({
        success: true,
        result
      })
    }

    if (action === "hints") {
      const amount =
        Number(body.amount || 5)

      const result =
        await completeHintPurchase(
          walletAddress,
          amount
        )

      return NextResponse.json({
        success: true,
        result
      })
    }

    if (
      action === "revive" ||
      action === "lives"
    ) {
      const result =
        await completeRevivePurchase(
          walletAddress
        )

      return NextResponse.json({
        success: true,
        result
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unknown action"
      },
      {
        status: 400
      }
    )
  } catch (error: any) {
    console.error(
      "Purchase API Error",
      error
    )

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Purchase failed"
      },
      {
        status: 500
      }
    )
  }
}
