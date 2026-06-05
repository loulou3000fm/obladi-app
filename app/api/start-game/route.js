import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { room_id } = await request.json()
    if (!room_id) return NextResponse.json({ error: 'room_id required' }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const now = new Date().toISOString()

    const { error } = await supabase.from('rooms').update({
      status: 'playing',
      phase: 'intro',
      phase_started_at: now,
      current_song_index: 0,
      started_at: now
    }).eq('id', room_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ phase_started_at: now })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
