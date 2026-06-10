import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const result = { releaseDate: null, label: null, bio: null }
  try {
    const { searchParams } = new URL(request.url)
    const deezerId = searchParams.get('deezer_id')
    const artist = searchParams.get('artist')

    // DEEZER : date de sortie + label
    if (deezerId) {
      try {
        const trackRes = await fetch(`https://api.deezer.com/track/${deezerId}`)
        const track = await trackRes.json()
        if (track && track.release_date) result.releaseDate = track.release_date
        const albumId = track?.album?.id
        if (albumId) {
          try {
            const albumRes = await fetch(`https://api.deezer.com/album/${albumId}`)
            const album = await albumRes.json()
            if (album) {
              if (album.label) result.label = album.label
              if (album.release_date) result.releaseDate = album.release_date
            }
          } catch {}
        }
      } catch {}
    }

    // LAST.FM : bio d'artiste
    if (artist && process.env.LASTFM_API_KEY) {
      try {
        const res = await fetch(
          `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(artist)}&lang=fr&api_key=${process.env.LASTFM_API_KEY}&format=json`
        )
        const data = await res.json()
        let summary = data?.artist?.bio?.summary || ''
        if (summary) {
          summary = summary.replace(/<[^>]+>/g, '')          // retire le HTML
          summary = summary.split(/Read more|Lire la suite/i)[0] // coupe le lien Last.fm
          summary = summary.trim()
          if (summary.length > 280) {
            const cut = summary.slice(0, 280)
            const lastSpace = cut.lastIndexOf(' ')
            summary = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + '…'
          }
          if (summary) result.bio = summary
        }
      } catch {}
    }

    return NextResponse.json(result, { headers: { 'Cache-Control': 'public, max-age=86400' } })
  } catch {
    return NextResponse.json(result)
  }
}
