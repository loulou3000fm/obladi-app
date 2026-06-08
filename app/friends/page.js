'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '../../lib/supabase'
import { getLevel } from '../../lib/game'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const AVATARS = { avatar_1:'🎵', avatar_2:'🎸', avatar_3:'🎹', avatar_4:'🥁', avatar_5:'🎺', avatar_6:'🎻', avatar_7:'🎤', avatar_8:'🎧' }

function FriendRow({ profile, right }) {
  const lvl = getLevel(profile?.total_score || 0)
  return (
    <div className="friend-row" style={{display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px', border:'1px solid #f0f0f0', borderRadius:'12px'}}>
      <Link href={`/player/${profile?.id}`} className="friend-link" style={{display:'flex', alignItems:'center', gap:'12px', flex:1, minWidth:0, textDecoration:'none', color:'inherit'}}>
        <span style={{fontSize:'24px', flexShrink:0}}>{AVATARS[profile?.avatar_id] || '🎵'}</span>
        <div style={{minWidth:0}}>
          <p style={{fontSize:'14px', fontWeight:'500', color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{profile?.pseudo || 'Joueur'}</p>
          <p style={{fontSize:'12px', color:'#999'}}>{lvl.emoji} {lvl.name}</p>
        </div>
      </Link>
      <div style={{display:'flex', gap:'6px', alignItems:'center', flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end'}}>{right}</div>
    </div>
  )
}

export default function Friends() {
  const router = useRouter()
  const [viewer, setViewer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [mesAmis, setMesAmis] = useState([])
  const [demandesRecues, setDemandesRecues] = useState([])
  const [demandesEnvoyees, setDemandesEnvoyees] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const searchTimeout = useRef(null)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setViewer(user)
      await loadAll(user.id)
      setLoading(false)
    }
    init()
  }, [])

  async function loadAll(viewerId) {
    const supabase = createClient()
    const [acceptedRes, recvRes, sentRes] = await Promise.all([
      supabase.from('friendships').select('*').eq('status', 'accepted').or(`requester_id.eq.${viewerId},addressee_id.eq.${viewerId}`),
      supabase.from('friendships').select('*').eq('status', 'pending').eq('addressee_id', viewerId),
      supabase.from('friendships').select('*').eq('status', 'pending').eq('requester_id', viewerId),
    ])
    const accepted = acceptedRes.data || []
    const recv = recvRes.data || []
    const sent = sentRes.data || []

    const friendIds = accepted.map(f => f.requester_id === viewerId ? f.addressee_id : f.requester_id)
    const recvIds = recv.map(f => f.requester_id)
    const sentIds = sent.map(f => f.addressee_id)
    const allIds = [...new Set([...friendIds, ...recvIds, ...sentIds])]

    const profileMap = {}
    if (allIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, pseudo, avatar_id, total_score').in('id', allIds)
      for (const p of (profs || [])) profileMap[p.id] = p
    }
    const fallback = id => profileMap[id] || { id, pseudo: 'Joueur', avatar_id: null, total_score: 0 }

    setMesAmis(accepted.map(f => {
      const otherId = f.requester_id === viewerId ? f.addressee_id : f.requester_id
      return { friendshipId: f.id, profile: fallback(otherId) }
    }))
    setDemandesRecues(recv.map(f => ({ friendshipId: f.id, profile: fallback(f.requester_id) })))
    setDemandesEnvoyees(sent.map(f => ({ friendshipId: f.id, profile: fallback(f.addressee_id) })))
  }

  async function act(action, { friendshipId, targetId }) {
    if (busy) return
    setBusy(true)
    setErr('')
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, viewerId: viewer.id, targetId, friendshipId })
      })
      const data = await res.json()
      if (!data.ok) setErr("Une erreur est survenue. Réessaie.")
    } catch {
      setErr("Une erreur est survenue. Réessaie.")
    }
    if (viewer) await loadAll(viewer.id)
    setBusy(false)
  }

  function handleSearchInput(e) {
    const value = e.target.value
    setSearchTerm(value)
    clearTimeout(searchTimeout.current)
    if (!value.trim()) { setSearchResults([]); setSearching(false); return }
    setSearching(true)
    searchTimeout.current = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('profiles')
        .select('id, pseudo, avatar_id, total_score')
        .ilike('pseudo', `%${value.trim()}%`)
        .neq('id', viewer.id)
        .limit(10)
      setSearchResults(data || [])
      setSearching(false)
    }, 350)
  }

  function relState(rid) {
    if (mesAmis.some(a => a.profile?.id === rid)) return { kind: 'friend' }
    if (demandesEnvoyees.some(d => d.profile?.id === rid)) return { kind: 'sent' }
    const recv = demandesRecues.find(d => d.profile?.id === rid)
    if (recv) return { kind: 'recv', friendshipId: recv.friendshipId }
    return { kind: 'none' }
  }

  if (loading) return (
    <main style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui'}}>
      <p style={{color:'#999', fontSize:'14px'}}>Chargement...</p>
    </main>
  )

  const btnPrimary = { padding:'8px 16px', backgroundColor:'#3b82f6', color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'500', cursor:'pointer', opacity: busy ? 0.6 : 1 }
  const btnDanger = { padding:'8px 14px', backgroundColor:'transparent', color:'#ef4444', border:'1px solid #fee2e2', borderRadius:'8px', fontSize:'13px', cursor:'pointer', opacity: busy ? 0.6 : 1 }

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#fff', fontFamily:'system-ui, sans-serif'}}>
      <style>{`
        .friend-link:hover p:first-child { text-decoration: underline; }
        @media (max-width: 768px) {
          .friends-nav { padding: 16px 24px !important; }
          .friends-container { padding: 24px 16px !important; }
        }
      `}</style>

      <nav className="friends-nav" style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'24px 48px', borderBottom:'1px solid #f0f0f0'}}>
        <button onClick={() => router.push('/dashboard')} style={{background:'none', border:'none', cursor:'pointer', fontSize:'14px', color:'#666'}}>← Retour</button>
        <a href="/" style={{display:'flex', alignItems:'baseline', gap:'2px', textDecoration:'none'}}>
          <span style={{fontSize:'18px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>obladi</span>
          <span style={{fontSize:'18px', fontWeight:'500', color:'#3b82f6'}}>.</span>
        </a>
      </nav>

      <div className="friends-container" style={{maxWidth:'600px', margin:'0 auto', padding:'48px'}}>
        <h1 style={{fontSize:'28px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111', marginBottom:'32px'}}>Amis</h1>

        {err && <p style={{fontSize:'13px', color:'#ef4444', marginBottom:'16px'}}>{err}</p>}

        {/* A) Recherche */}
        <div style={{marginBottom:'40px'}}>
          <h2 style={{fontSize:'16px', fontWeight:'500', color:'#111', marginBottom:'12px', letterSpacing:'-0.3px'}}>Rechercher des joueurs</h2>
          <input
            value={searchTerm}
            onChange={handleSearchInput}
            placeholder="Pseudo d'un joueur…"
            style={{width:'100%', padding:'12px 16px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'16px', outline:'none', color:'#111', boxSizing:'border-box', marginBottom:'12px'}}
          />
          {searching && <p style={{fontSize:'13px', color:'#999'}}>Recherche…</p>}
          {!searching && searchTerm.trim() && searchResults.length === 0 && (
            <p style={{fontSize:'13px', color:'#999'}}>Aucun joueur trouvé.</p>
          )}
          <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
            {searchResults.map(r => {
              const st = relState(r.id)
              const right = st.kind === 'friend'
                ? <span style={{fontSize:'13px', color:'#16a34a', fontWeight:'500'}}>✓ Amis</span>
                : st.kind === 'sent'
                ? <span style={{fontSize:'13px', color:'#999'}}>Demande envoyée</span>
                : st.kind === 'recv'
                ? <button disabled={busy} onClick={() => act('accept', { friendshipId: st.friendshipId })} style={btnPrimary}>Accepter</button>
                : <button disabled={busy} onClick={() => act('send', { targetId: r.id })} style={btnPrimary}>+ Ajouter</button>
              return <FriendRow key={r.id} profile={r} right={right} />
            })}
          </div>
        </div>

        {/* B) Demandes reçues */}
        {demandesRecues.length > 0 && (
          <div style={{marginBottom:'40px'}}>
            <h2 style={{fontSize:'16px', fontWeight:'500', color:'#111', marginBottom:'12px', letterSpacing:'-0.3px'}}>Demandes reçues ({demandesRecues.length})</h2>
            <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
              {demandesRecues.map(d => (
                <FriendRow key={d.friendshipId} profile={d.profile} right={
                  <>
                    <button disabled={busy} onClick={() => act('accept', { friendshipId: d.friendshipId })} style={btnPrimary}>Accepter</button>
                    <button disabled={busy} onClick={() => act('decline', { friendshipId: d.friendshipId })} style={btnDanger}>Refuser</button>
                  </>
                } />
              ))}
            </div>
          </div>
        )}

        {/* C) Mes amis */}
        <div>
          <h2 style={{fontSize:'16px', fontWeight:'500', color:'#111', marginBottom:'12px', letterSpacing:'-0.3px'}}>Mes amis ({mesAmis.length})</h2>
          {mesAmis.length === 0 ? (
            <div style={{padding:'24px', border:'1px solid #f0f0f0', borderRadius:'12px', textAlign:'center'}}>
              <p style={{fontSize:'14px', color:'#999'}}>Tu n'as pas encore d'amis. Cherche des joueurs ci-dessus.</p>
            </div>
          ) : (
            <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
              {mesAmis.map(a => (
                <FriendRow key={a.friendshipId} profile={a.profile} right={
                  <button disabled={busy} onClick={() => act('remove', { friendshipId: a.friendshipId })}
                    style={{padding:'8px 14px', backgroundColor:'transparent', color:'#999', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'13px', cursor:'pointer', opacity: busy ? 0.6 : 1}}>
                    Retirer
                  </button>
                } />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
