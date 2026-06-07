import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()
    const songs = Array.isArray(body) ? body : body.songs
    if (!Array.isArray(songs)) return NextResponse.json({ error: 'songs array required' }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    for (const s of songs) {
      if (!s || !s.id) continue
      const { error } = await supabase.from('songs').update({ position: s.position }).eq('id', s.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
