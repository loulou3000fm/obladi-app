import { NextResponse } from 'next/server'

async function getSpotifyToken() {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(
        process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
      ).toString('base64')
    },
    body: 'grant_type=client_credentials'
  })
  const data = await res.json()
  return data.access_token
}

async function findYoutubeVideo(artist, title) {
  const query = `${artist} ${title} official video`
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`
  )
  const data = await res.json()
  return data.items?.[0]?.id?.videoId || null
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const token = await getSpotifyToken()

  if (type === 'search') {
    const query = searchParams.get('q')
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
    const data = await res.json()
    const tracks = data.tracks?.items || []

    const tracksWithYoutube = await Promise.all(
      tracks.map(async track => {
        const youtube_id = await findYoutubeVideo(track.artists[0].name, track.name)
        return { ...track, youtube_id }
      })
    )
    return NextResponse.json(tracksWithYoutube)
  }

  if (type === 'playlist') {
    const playlistId = searchParams.get('id')
    console.log('Fetching playlist:', playlistId)
    const res = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
    const data = await res.json()
    console.log('Spotify response status:', res.status)
    console.log('Items count:', data.items?.length)
    console.log('First item:', JSON.stringify(data.items?.[0]?.track?.name))

    const tracks = data.items?.filter(item => item.track) || []
    console.log('Filtered tracks:', tracks.length)

    const tracksWithYoutube = await Promise.all(
      tracks.map(async item => {
        const track = item.track
        const youtube_id = await findYoutubeVideo(track.artists[0].name, track.name)
        console.log('YouTube for', track.name, ':', youtube_id)
        return {
          spotify_id: track.id,
          title: track.name,
          artist: track.artists[0].name,
          album: track.album.name,
          cover_url: track.album.images[0]?.url,
          preview_url: track.preview_url || null,
          duration_ms: track.duration_ms,
          youtube_id
        }
      })
    )
    return NextResponse.json(tracksWithYoutube)
  }

  return NextResponse.json({ error: 'Invalid type' })
}
