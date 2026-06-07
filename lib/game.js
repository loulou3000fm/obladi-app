export function normalizeAnswer(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

export function checkAnswer(input, correct) {
  const a = normalizeAnswer(input)
  const b = normalizeAnswer(correct)
  if (a === b) return true
  if (a.length < 3) return false
  if (b.includes(a) || a.includes(b)) return true
  return false
}

export function closeAnswer(input, correct) {
  const a = normalizeAnswer(input)
  const b = normalizeAnswer(correct)
  if (a.length < 2) return false
  const shorter = a.length <= b.length ? a : b
  const longerArr = (a.length <= b.length ? b : a).split('')
  let matches = 0
  for (const ch of shorter) {
    const idx = longerArr.indexOf(ch)
    if (idx !== -1) { matches++; longerArr.splice(idx, 1) }
  }
  return matches / shorter.length >= 0.6
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
