export function normalizeAnswer(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

export function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = []
  for (let i = 0; i <= m; i++) {
    dp[i] = [i]
    for (let j = 1; j <= n; j++) dp[i][j] = i === 0 ? j : 0
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
    }
  }
  return dp[m][n]
}

export function checkAnswer(input, correct) {
  const a = normalizeAnswer(input)
  const b = normalizeAnswer(correct)
  if (a.length < 2) return false
  if (a === b) return true
  return levenshtein(a, b) <= 2
}

function toWords(str) {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim().split(/\s+/).filter(Boolean)
}

export function closeAnswer(input, correct) {
  const a = normalizeAnswer(input)
  const b = normalizeAnswer(correct)
  if (a.length < 2) return false
  const dist = levenshtein(a, b)
  if (dist >= 3 && dist <= 5) return true
  const correctWords = toWords(correct)
  const userWords = toWords(input)
  if (correctWords.length === 0) return false
  const matched = correctWords.filter(w => userWords.some(uw => uw === w || levenshtein(uw, w) <= 1))
  return matched.length / correctWords.length >= 0.7
}

export function calculatePoints(correct, timeLeft, maxTime = 30) {
  if (!correct) return 0
  const bonus = Math.round((timeLeft / maxTime) * 50)
  return 100 + bonus
}

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export const INTRO_DURATION = 20
export const PLAY_DURATION = 20
export const REVEAL_DURATION = 5

export function remainingSeconds(phaseStartedAt, duration) {
  if (!phaseStartedAt) return duration
  const elapsed = (Date.now() - new Date(phaseStartedAt).getTime()) / 1000
  return Math.max(0, duration - elapsed)
}
