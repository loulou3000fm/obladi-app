import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const MB_HEADERS = { 'User-Agent': 'Obladi/1.0 ( https://obladi.live )', 'Accept': 'application/json' }
const COUNTRY_FR = {
  'United States': 'États-Unis',
  'United Kingdom': 'Royaume-Uni',
  'Germany': 'Allemagne',
  'Australia': 'Australie',
  'Sweden': 'Suède',
}
const frCountry = name => (name ? (COUNTRY_FR[name] || name) : null)
const year = d => (d ? String(d).slice(0, 4) : null)

export async function GET(request) {
  const result = { releaseDate: null, label: null, origin: null, yearsActive: null, members: [] }
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

    // MUSICBRAINZ : origine, période d'activité, membres
    if (artist) {
      try {
        // Essai 1 : recherche par nom simple (le plus fiable), entièrement encodée
        const q1 = encodeURIComponent(artist)
        let searchRes = await fetch(`https://musicbrainz.org/ws/2/artist/?query=${q1}&fmt=json&limit=5`, { headers: MB_HEADERS })
        let searchData = await searchRes.json()
        // Essai 2 : requête par champ correctement encodée
        if (!searchData?.artists?.length) {
          const q2 = encodeURIComponent(`artist:${artist}`)
          searchRes = await fetch(`https://musicbrainz.org/ws/2/artist/?query=${q2}&fmt=json&limit=5`, { headers: MB_HEADERS })
          searchData = await searchRes.json()
        }
        const a = searchData?.artists?.[0] // le mieux scoré
        if (a) {
          // Origine : begin-area puis area, sans doublon ni null, mappées en FR
          const beginArea = frCountry(a['begin-area']?.name)
          const area = frCountry(a.area?.name)
          const origin = [...new Set([beginArea, area].filter(Boolean))].join(', ')
          if (origin) result.origin = origin

          // Période d'activité
          const ls = a['life-span'] || {}
          const begin = year(ls.begin)
          const end = year(ls.end)
          if (ls.ended && end) result.yearsActive = `${begin || '?'}–${end}`
          else if (begin) result.yearsActive = `depuis ${begin}`

          // Membres (uniquement pour un groupe)
          if (a.type === 'Group' && a.id) {
            try {
              const relRes = await fetch(
                `https://musicbrainz.org/ws/2/artist/${a.id}?inc=artist-rels&fmt=json`,
                { headers: MB_HEADERS }
              )
              const relData = await relRes.json()
              const names = []
              for (const rel of (relData?.relations || [])) {
                if (rel.type === 'member of band' && rel.artist?.name && !names.includes(rel.artist.name)) {
                  names.push(rel.artist.name)
                }
              }
              result.members = names.slice(0, 6)
            } catch {}
          }
        }
      } catch {}
    }

    return NextResponse.json(result, { headers: { 'Cache-Control': 'public, max-age=86400' } })
  } catch {
    return NextResponse.json(result)
  }
}
