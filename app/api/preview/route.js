import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const deezerId = searchParams.get('deezer_id')
  const url = searchParams.get('url')

  try {
    // Détermine l'URL cible : preview FRAÎCHE via deezer_id (prioritaire), sinon url fournie (fallback)
    let targetUrl
    if (deezerId) {
      const trackRes = await fetch(`https://api.deezer.com/track/${deezerId}`)
      const json = await trackRes.json()
      if (!json || !json.preview) {
        return NextResponse.json({ error: 'no fresh preview' }, { status: 404 })
      }
      targetUrl = json.preview
    } else if (url) {
      targetUrl = url
    } else {
      return NextResponse.json({ error: 'No URL' }, { status: 400 })
    }

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
        'Referer': 'https://www.deezer.com/',
      }
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed', status: response.status }, { status: response.status })
    }

    const arrayBuffer = await response.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const total = bytes.length

    const range = request.headers.get('range')
    const match = range && /^bytes=(\d+)-(\d*)$/.exec(range)

    if (match) {
      const start = parseInt(match[1], 10)
      let end = match[2] ? parseInt(match[2], 10) : total - 1
      if (end > total - 1) end = total - 1
      if (isNaN(start) || start > end || start < 0) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${total}`,
            'Accept-Ranges': 'bytes',
          }
        })
      }
      const length = end - start + 1
      const chunk = bytes.slice(start, end + 1)
      return new NextResponse(chunk, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(length),
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        }
      })
    }

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Length': String(total),
        'Accept-Ranges': 'bytes',
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      }
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
