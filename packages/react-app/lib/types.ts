export interface ClassicProgress {
    level: number
}

export interface ChallengeProgress {
    chances: number
    lastResetUnixMilliseconds: number
    streakCycleIndex: number
    streakMask: number
    bestTimeSeconds: number
}

export interface UniversalProgress {
    weeklyChallengeCycleIndex: number
    weeklyChallengeEndUnixMilliseconds: number
}

export interface UserSnapshot {
    walletAddress: string
    username: string
    hasPurchasedGame: boolean
    hints: number
    tutorialCompleted: boolean
    classic: ClassicProgress
    challenge: ChallengeProgress
    universal: UniversalProgress
}
