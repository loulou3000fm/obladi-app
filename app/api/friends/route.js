import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const { action, viewerId, targetId, friendshipId } = await request.json()
    if (!action) return NextResponse.json({ ok: false, error: 'action required' }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const now = new Date().toISOString()

    if (action === 'send') {
      if (!viewerId || !targetId) return NextResponse.json({ ok: false, error: 'viewerId and targetId required' }, { status: 400 })
      if (viewerId === targetId) return NextResponse.json({ ok: false, error: 'cannot befriend yourself' }, { status: 400 })

      // Relation existante dans les deux sens
      const { data: existing, error: selErr } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(requester_id.eq.${viewerId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${viewerId})`)
      if (selErr) return NextResponse.json({ ok: false, error: selErr.message }, { status: 500 })

      const rows = existing || []
      const accepted = rows.find(f => f.status === 'accepted')
      if (accepted) return NextResponse.json({ ok: true, status: 'accepted' })

      const pendingFromTarget = rows.find(f => f.status === 'pending' && f.requester_id === targetId && f.addressee_id === viewerId)
      if (pendingFromTarget) {
        const { error } = await supabase.from('friendships').update({ status: 'accepted', updated_at: now }).eq('id', pendingFromTarget.id)
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
        return NextResponse.json({ ok: true, status: 'accepted' })
      }

      const pendingFromViewer = rows.find(f => f.status === 'pending' && f.requester_id === viewerId && f.addressee_id === targetId)
      if (pendingFromViewer) return NextResponse.json({ ok: true, status: 'pending' })

      const { error: insErr } = await supabase.from('friendships').insert({ requester_id: viewerId, addressee_id: targetId, status: 'pending' })
      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })
      return NextResponse.json({ ok: true, status: 'pending' })
    }

    if (action === 'accept') {
      if (!friendshipId) return NextResponse.json({ ok: false, error: 'friendshipId required' }, { status: 400 })
      const { error } = await supabase.from('friendships').update({ status: 'accepted', updated_at: now }).eq('id', friendshipId)
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (action === 'decline' || action === 'cancel' || action === 'remove') {
      if (!friendshipId) return NextResponse.json({ ok: false, error: 'friendshipId required' }, { status: 400 })
      const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
