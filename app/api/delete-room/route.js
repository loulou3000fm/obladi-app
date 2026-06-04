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

    const { error: e1 } = await supabase.from('answers').delete().eq('room_id', room_id)
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

    const { error: e2 } = await supabase.from('room_players').delete().eq('room_id', room_id)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

    const { error: e3 } = await supabase.from('rooms').delete().eq('id', room_id)
    if (e3) return NextResponse.json({ error: e3.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
