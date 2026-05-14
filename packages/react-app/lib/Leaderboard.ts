export async function saveScore(
  gameName: string,
  wallet: string,
  username: string,
  score: number
) {
  await fetch("/api/saveScore", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      gameName,
      wallet,
      username,
      score,
    }),
  })
}

export async function getLeaderboard(gameName: string) {
  const res = await fetch("/api/getLeaderboard", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ gameName }),
  })

  if (!res.ok) {
    return []
  }

  return await res.json()
}