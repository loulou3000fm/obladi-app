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

export function calculatePoints(correct, timeLeft, maxTime = 30) {
  if (!correct) return 0
  const bonus = Math.round((timeLeft / maxTime) * 50)
  return 100 + bonus
}

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
