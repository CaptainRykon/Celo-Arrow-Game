import { ref, get, set } from "firebase/database"
import { initFirebase, getFirebase } from "./firebase"

export async function saveScore(
  gameName: string,
  wallet: string,
  username: string,
  score: number
) {
  await initFirebase()

  const { db, authReady } = getFirebase()
  await authReady

  const userRef = ref(db, `leaderboards/${gameName}/${wallet}`)
  const snapshot = await get(userRef)

  if (snapshot.exists()) {
    const existing = snapshot.val()

    if (score > existing.score) {
      await set(userRef, {
        username,
        score,
        timestamp: Date.now(),
      })
    }
  } else {
    await set(userRef, {
      username,
      score,
      timestamp: Date.now(),
    })
  }
}

export async function getLeaderboard(gameName: string) {
  await initFirebase()

  const { db, authReady } = getFirebase()
  await authReady

  const snapshot = await get(ref(db, `leaderboards/${gameName}`))

  if (!snapshot.exists()) return []

  const data = snapshot.val()

  return Object.values(data)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 50)
}