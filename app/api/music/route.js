import { NextResponse } from 'next/server'

async function findYoutubeVideo(artist, title) {
  const query = `${artist} ${title} official video`
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`
  )
  const data = await res.json()
  return data.items?.[0]?.id?.videoId || null
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  if (type === 'search') {
    const query = searchParams.get('q')
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=10`
    )
    const data = await res.json()
    const tracks = data.data || []

    const tracksWithYoutube = await Promise.all(
      tracks.map(async track => {
        const youtube_id = await findYoutubeVideo(track.artist.name, track.title)
        return {
          id: track.id,
          name: track.title,
          artists: [{ name: track.artist.name }],
          album: {
            name: track.album.title,
            images: [{ url: track.album.cover_medium }]
          },
          preview_url: track.preview,
          duration_ms: track.duration * 1000,
          youtube_id
        }
      })
    )
    return NextResponse.json(tracksWithYoutube)
  }

  if (type === 'playlist') {
    const playlistId = searchParams.get('id')
    const res = await fetch(
      `https://api.deezer.com/playlist/${playlistId}/tracks?limit=50`
    )
    const data = await res.json()
    const tracks = data.data || []

    const tracksWithYoutube = await Promise.all(
      tracks.map(async track => {
        const youtube_id = await findYoutubeVideo(track.artist.name, track.title)
        return {
          spotify_id: null,
          deezer_id: String(track.id),
          title: track.title,
          artist: track.artist.name,
          album: track.album.title,
          cover_url: track.album.cover_medium,
          preview_url: track.preview,
          duration_ms: track.duration * 1000,
          youtube_id
        }
      })
    )
    return NextResponse.json(tracksWithYoutube)
  }

  if (type === 'youtube') {
    const query = searchParams.get('q')
    if (!query) return NextResponse.json({ error: 'q required' }, { status: 400 })
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query + ' official video')}&type=video&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`
    )
    const data = await res.json()
    const youtube_id = data.items?.[0]?.id?.videoId || null
    return NextResponse.json({ youtube_id })
  }

  return NextResponse.json({ error: 'Invalid type' })
}
