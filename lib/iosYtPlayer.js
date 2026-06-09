// Player YouTube unique et PERSISTANT (monté sur document.body, hors React).
// But : déverrouiller l'audio iOS via un geste utilisateur dans le lobby ("Je suis prêt")
// et réutiliser LE MÊME player sur la page de jeu (iOS débloque par élément, pas par page).

let player = null
let ready = false
let creating = false
let unlocked = false
let pendingId = null

function loadAPI(cb) {
  if (window.YT && window.YT.Player) { cb(); return }
  const prev = window.onYouTubeIframeAPIReady
  window.onYouTubeIframeAPIReady = () => { if (prev) { try { prev() } catch {} } cb() }
  if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.body.appendChild(tag)
  }
}

// Crée le player une seule fois. Idempotent.
export function ensureIOSPlayer() {
  if (typeof window === 'undefined') return
  if (player || creating) return
  creating = true

  let container = document.getElementById('global-ios-yt')
  if (!container) {
    container = document.createElement('div')
    container.id = 'global-ios-yt'
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;overflow:hidden'
    document.body.appendChild(container)
  }
  const mount = document.createElement('div')
  container.appendChild(mount)

  function create() {
    if (player || !(window.YT && window.YT.Player)) return
    player = new window.YT.Player(mount, {
      height: '1',
      width: '1',
      playerVars: { playsinline: 1, controls: 0, disablekb: 1 },
      events: {
        onReady: () => {
          ready = true
          if (pendingId) { try { player.loadVideoById(pendingId) } catch {} ; pendingId = null }
        },
      },
    })
  }

  loadAPI(create)
  // Filet : on poll jusqu'à ce que l'API soit dispo et le player créé
  const poll = setInterval(() => {
    if (player) { clearInterval(poll); return }
    if (window.YT && window.YT.Player) create()
  }, 400)
}

export function isIOSPlayerReady() { return ready }
export function wasIOSUnlocked() { return unlocked }

// À appeler DANS un geste utilisateur (tap). Débloque la lecture audible pour ce player.
export function unlockIOSPlayer() {
  if (!player || !ready) return false
  try { player.playVideo(); player.pauseVideo() } catch {}
  unlocked = true
  return true
}

export function playIOSVideo(youtubeId) {
  if (!youtubeId) return
  if (!player || !ready) { pendingId = youtubeId; return }
  try { player.loadVideoById(youtubeId) } catch {}
}

export function stopIOSVideo() {
  pendingId = null
  if (!player) return
  try { player.stopVideo ? player.stopVideo() : player.pauseVideo() } catch {}
}
