import { NextResponse } from "next/server"

import {
  purchaseGame,
  purchaseHints,
  purchaseLives
} from "@/lib/purchase"

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json()

      const action =
          body.action


      const token =
          body.token || "USDT"

    // =========================
    // PURCHASE GAME
    // =========================
    if (
      action === "game"
    ) {
      const result =
          await purchaseGame(token)

      return NextResponse.json({
        success: true,
        result
      })
    }

    // =========================
    // PURCHASE HINTS
    // =========================
    if (
      action === "hints"
    ) {
      const amount =
        Number(
          body.amount || 10
        )

      const result =
          await purchaseHints(
              amount,
              token
          )

      return NextResponse.json({
        success: true,
        result
      })
    }

    // =========================
    // PURCHASE LIVES
    // =========================
    if (
      action === "lives"
    ) {
      const amount =
        Number(
          body.amount || 3
        )

      const result =
          await purchaseLives(
              amount,
              token
          )

      return NextResponse.json({
        success: true,
        result
      })
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "Unknown action"
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