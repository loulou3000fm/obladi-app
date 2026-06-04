import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 })

  console.log('Fetching audio:', url.substring(0, 80))

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
        'Referer': 'https://www.deezer.com/',
      }
    })

    console.log('Audio response status:', response.status, 'Content-Type:', response.headers.get('content-type'))

    if (!response.ok) {
      console.log('Audio fetch failed:', response.status)
      return NextResponse.json({ error: 'Failed' }, { status: response.status })
    }

    const buffer = await response.arrayBuffer()
    console.log('Audio buffer size:', buffer.byteLength)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'public, max-age=3600',
      }
    })
  } catch (e) {
    console.log('Audio error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
