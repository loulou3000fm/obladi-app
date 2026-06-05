import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { INTRO_DURATION, PLAY_DURATION, REVEAL_DURATION, remainingSeconds } from '../../../lib/game'

export async function POST(request) {
  try {
    const { room_code } = await request.json()
    if (!room_code) return NextResponse.json({ error: 'room_code required' }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: room } = await supabase
      .from('rooms')
      .select('id, status, phase, phase_started_at, current_song_index, playlist_id')
      .eq('code', room_code.toUpperCase())
      .single()

    if (!room) return NextResponse.json({ error: 'room not found' }, { status: 404 })
    if (room.status !== 'playing') return NextResponse.json({ status: room.status })

    const duration = room.phase === 'intro' ? INTRO_DURATION : room.phase === 'playing' ? PLAY_DURATION : REVEAL_DURATION
    const remaining = remainingSeconds(room.phase_started_at, duration)

    console.log('tick called, room phase:', room?.phase, 'remaining:', remaining)

    if (remaining > 0) {
      return NextResponse.json({
        status: room.status,
        phase: room.phase,
        phase_started_at: room.phase_started_at,
        current_song_index: room.current_song_index,
        remaining
      })
    }

    const now = new Date().toISOString()

    if (room.phase === 'intro') {
      console.log('transition: intro -> playing, index:', room.current_song_index)
      await supabase.from('rooms').update({ phase: 'playing', phase_started_at: now }).eq('id', room.id)
      return NextResponse.json({ status: 'playing', phase: 'playing', phase_started_at: now, current_song_index: room.current_song_index, remaining: PLAY_DURATION })
    }

    if (room.phase === 'playing') {
      console.log('transition: playing -> reveal, index:', room.current_song_index)
      await supabase.from('rooms').update({ phase: 'reveal', phase_started_at: now }).eq('id', room.id)
      return NextResponse.json({ status: 'playing', phase: 'reveal', phase_started_at: now, current_song_index: room.current_song_index, remaining: REVEAL_DURATION })
    }

    if (room.phase === 'reveal') {
      const { count } = await supabase.from('songs').select('*', { count: 'exact', head: true }).eq('playlist_id', room.playlist_id)
      const nextIndex = room.current_song_index + 1
      if (nextIndex < count) {
        console.log('transition: reveal -> playing, index:', nextIndex)
        await supabase.from('rooms').update({ phase: 'playing', phase_started_at: now, current_song_index: nextIndex }).eq('id', room.id)
        return NextResponse.json({ status: 'playing', phase: 'playing', phase_started_at: now, current_song_index: nextIndex, remaining: PLAY_DURATION })
      } else {
        console.log('transition: reveal -> finished')
        await supabase.from('rooms').update({ status: 'finished', phase: 'finished' }).eq('id', room.id)
        return NextResponse.json({ status: 'finished', phase: 'finished', current_song_index: room.current_song_index, remaining: 0 })
      }
    }

    return NextResponse.json({ status: room.status, phase: room.phase, phase_started_at: room.phase_started_at, current_song_index: room.current_song_index, remaining })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
