'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import { getLevel } from '../../../lib/game'
import { useParams, useRouter } from 'next/navigation'

const AVATARS = { avatar_1:'🎵', avatar_2:'🎸', avatar_3:'🎹', avatar_4:'🥁', avatar_5:'🎺', avatar_6:'🎻', avatar_7:'🎤', avatar_8:'🎧' }

export default function PublicProfile() {
  const { id } = useParams()
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [viewer, setViewer] = useState(null)
  const [relation, setRelation] = useState(null)
  const [friendLoading, setFriendLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: prof } = await supabase
        .from('profiles')
        .select('pseudo, avatar_id, total_score, games_played, best_score, bio, created_at')
        .eq('id', id)
        .maybeSingle()

      if (!prof) { setNotFound(true); setLoading(false); return }
      setProfile(prof)

      const { data: hist } = await supabase
        .from('game_sessions')
        .select('id, theme, score, played_at, room_code')
        .eq('player_id', id)
        .eq('completed', true)
        .order('played_at', { ascending: false })
        .limit(20)
      setSessions(hist || [])

      const { data: { user } } = await supabase.auth.getUser()
      setViewer(user || null)
      if (user && user.id !== id) {
        await refreshRelation(user.id)
      }

      setLoading(false)
    }
    load()
  }, [id])

  async function refreshRelation(viewerId) {
    const supabase = createClient()
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(requester_id.eq.${viewerId},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${viewerId})`)
    const rows = data || []
    const accepted = rows.find(f => f.status === 'accepted')
    if (accepted) { setRelation({ state: 'accepted', friendshipId: accepted.id }); return }
    const sent = rows.find(f => f.status === 'pending' && f.requester_id === viewerId)
    if (sent) { setRelation({ state: 'pending_sent', friendshipId: sent.id }); return }
    const received = rows.find(f => f.status === 'pending' && f.addressee_id === viewerId)
    if (received) { setRelation({ state: 'pending_received', friendshipId: received.id }); return }
    setRelation({ state: 'none', friendshipId: null })
  }

  async function friendAction(action, friendshipId) {
    if (!viewer || friendLoading) return
    setFriendLoading(true)
    try {
      await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, viewerId: viewer.id, targetId: id, friendshipId })
      })
    } catch {}
    await refreshRelation(viewer.id)
    setFriendLoading(false)
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  function formatMonth(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  }

  if (loading) return (
    <main style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui'}}>
      <p style={{color:'#999', fontSize:'14px'}}>Chargement...</p>
    </main>
  )

  if (notFound) return (
    <main style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui, sans-serif', padding:'24px'}}>
      <div style={{textAlign:'center'}}>
        <p style={{fontSize:'56px', marginBottom:'16px'}}>🎵</p>
        <h1 style={{fontSize:'24px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111', marginBottom:'8px'}}>Joueur introuvable</h1>
        <p style={{fontSize:'14px', color:'#999', marginBottom:'24px'}}>Ce profil n'existe pas ou n'est plus disponible.</p>
        <button onClick={() => router.push('/')} style={{padding:'12px 24px', backgroundColor:'#111', color:'#fff', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'500', cursor:'pointer'}}>
          Retour à l'accueil
        </button>
      </div>
    </main>
  )

  const lvl = getLevel(profile.total_score || 0)

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#fff', fontFamily:'system-ui, sans-serif'}}>
      <style>{`
        .player-session-clickable { cursor: pointer; transition: background-color 0.15s; }
        .player-session-clickable:hover { background-color: #f8f8f8; }
        @media (max-width: 768px) {
          .player-nav { padding: 16px 24px !important; }
          .player-container { padding: 24px 16px !important; }
          .player-stats { gap: 8px !important; }
          .player-avatar { font-size: 56px !important; }
          .player-pseudo { font-size: 32px !important; }
        }
      `}</style>

      <nav className="player-nav" style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'24px 48px', borderBottom:'1px solid #f0f0f0'}}>
        <button onClick={() => router.back()} style={{background:'none', border:'none', cursor:'pointer', fontSize:'14px', color:'#666'}}>← Retour</button>
        <a href="/" style={{display:'flex', alignItems:'baseline', gap:'2px', textDecoration:'none'}}>
          <span style={{fontSize:'18px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>obladi</span>
          <span style={{fontSize:'18px', fontWeight:'500', color:'#3b82f6'}}>.</span>
        </a>
      </nav>

      <div className="player-container" style={{maxWidth:'600px', margin:'0 auto', padding:'48px'}}>

        {/* En-tête profil */}
        <div style={{textAlign:'center', marginBottom:'40px'}}>
          <div className="player-avatar" style={{fontSize:'72px', marginBottom:'12px'}}>{AVATARS[profile.avatar_id] || '🎵'}</div>
          <h1 className="player-pseudo" style={{fontSize:'40px', fontWeight:'500', letterSpacing:'-1px', color:'#111', marginBottom:'8px', lineHeight:'1.1'}}>{profile.pseudo}</h1>
          <p style={{fontSize:'15px', color:'#666', marginBottom:'4px'}}>{lvl.emoji} {lvl.name}</p>
          {profile.created_at && <p style={{fontSize:'13px', color:'#999'}}>Membre depuis {formatMonth(profile.created_at)}</p>}

          {viewer && viewer.id !== id && relation && (
            <div style={{display:'flex', gap:'8px', justifyContent:'center', alignItems:'center', flexWrap:'wrap', marginTop:'20px'}}>
              {relation.state === 'none' && (
                <button disabled={friendLoading} onClick={() => friendAction('send')}
                  style={{padding:'10px 20px', backgroundColor:'#3b82f6', color:'#fff', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'500', cursor:'pointer', opacity: friendLoading ? 0.6 : 1}}>
                  + Ajouter en ami
                </button>
              )}
              {relation.state === 'pending_sent' && (
                <>
                  <span style={{fontSize:'14px', color:'#666'}}>Demande envoyée</span>
                  <button disabled={friendLoading} onClick={() => friendAction('cancel', relation.friendshipId)}
                    style={{padding:'8px 14px', backgroundColor:'transparent', color:'#999', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'13px', cursor:'pointer', opacity: friendLoading ? 0.6 : 1}}>
                    Annuler
                  </button>
                </>
              )}
              {relation.state === 'pending_received' && (
                <>
                  <button disabled={friendLoading} onClick={() => friendAction('accept', relation.friendshipId)}
                    style={{padding:'10px 20px', backgroundColor:'#3b82f6', color:'#fff', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'500', cursor:'pointer', opacity: friendLoading ? 0.6 : 1}}>
                    Accepter
                  </button>
                  <button disabled={friendLoading} onClick={() => friendAction('decline', relation.friendshipId)}
                    style={{padding:'10px 18px', backgroundColor:'transparent', color:'#ef4444', border:'1px solid #fee2e2', borderRadius:'8px', fontSize:'14px', cursor:'pointer', opacity: friendLoading ? 0.6 : 1}}>
                    Refuser
                  </button>
                </>
              )}
              {relation.state === 'accepted' && (
                <>
                  <span style={{fontSize:'14px', color:'#16a34a', fontWeight:'500'}}>✓ Amis</span>
                  <button disabled={friendLoading} onClick={() => friendAction('remove', relation.friendshipId)}
                    style={{padding:'8px 14px', backgroundColor:'transparent', color:'#ef4444', border:'1px solid #fee2e2', borderRadius:'8px', fontSize:'13px', cursor:'pointer', opacity: friendLoading ? 0.6 : 1}}>
                    Retirer
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Bio */}
        {profile.bio && (
          <p style={{fontSize:'15px', color:'#444', lineHeight:'1.6', textAlign:'center', maxWidth:'440px', margin:'0 auto 40px'}}>{profile.bio}</p>
        )}

        {/* Stats */}
        <div className="player-stats" style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'12px', marginBottom:'48px'}}>
          <div style={{padding:'20px 12px', backgroundColor:'#f8f8f8', borderRadius:'12px', textAlign:'center'}}>
            <p style={{fontSize:'24px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>{profile.total_score || 0}</p>
            <p style={{fontSize:'12px', color:'#999'}}>Score total</p>
          </div>
          <div style={{padding:'20px 12px', backgroundColor:'#f8f8f8', borderRadius:'12px', textAlign:'center'}}>
            <p style={{fontSize:'24px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>{profile.games_played || 0}</p>
            <p style={{fontSize:'12px', color:'#999'}}>Parties</p>
          </div>
          <div style={{padding:'20px 12px', backgroundColor:'#f8f8f8', borderRadius:'12px', textAlign:'center'}}>
            <p style={{fontSize:'24px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>{profile.best_score || 0}</p>
            <p style={{fontSize:'12px', color:'#999'}}>Meilleur score</p>
          </div>
        </div>

        {/* Historique */}
        <h2 style={{fontSize:'18px', fontWeight:'500', color:'#111', marginBottom:'16px', letterSpacing:'-0.3px'}}>Parties jouées</h2>
        <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
          {sessions.length === 0 ? (
            <div style={{padding:'24px', border:'1px solid #f0f0f0', borderRadius:'12px', textAlign:'center'}}>
              <p style={{fontSize:'14px', color:'#999'}}>Aucune partie jouée pour le moment.</p>
            </div>
          ) : (
            sessions.map(s => (
              <div key={s.id}
                className={s.room_code ? 'player-session-clickable' : ''}
                onClick={() => s.room_code && router.push(`/room/${s.room_code}/recap`)}
                style={{display:'flex', alignItems:'center', gap:'16px', padding:'16px 20px', border:'1px solid #f0f0f0', borderRadius:'12px'}}>
                <div style={{width:'40px', height:'40px', backgroundColor:'#f0f0f0', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0}}>
                  🎵
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <p style={{fontSize:'14px', fontWeight:'500', color:'#111', marginBottom:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.theme || 'Général'}</p>
                  <p style={{fontSize:'12px', color:'#999'}}>{formatDate(s.played_at)}</p>
                </div>
                <div style={{textAlign:'right', flexShrink:0}}>
                  <p style={{fontSize:'16px', fontWeight:'500', color:'#111'}}>{s.score} pts</p>
                </div>
                {s.room_code && <span style={{fontSize:'18px', color:'#ccc', flexShrink:0}}>→</span>}
              </div>
            ))
          )}
        </div>

      </div>
    </main>
  )
}
