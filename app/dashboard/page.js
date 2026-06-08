'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { getLevel } from '../../lib/game'
import { useRouter } from 'next/navigation'

const AVATARS = {
  avatar_1: '🎵', avatar_2: '🎸', avatar_3: '🎹',
  avatar_4: '🥁', avatar_5: '🎺', avatar_6: '🎻',
  avatar_7: '🎤', avatar_8: '🎧'
}

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const [sessions, setSessions] = useState([])
  const [activeRooms, setActiveRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)
      if (prof?.is_admin === true) { router.push('/admin'); return }

      const { data: hist } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('player_id', user.id)
        .eq('completed', true)
        .order('played_at', { ascending: false })
        .limit(10)
      setSessions(hist || [])

      const { data: rooms } = await supabase.from('rooms').select('*, playlists(name)').in('status', ['waiting', 'playing']).order('created_at', { ascending: false })
      setActiveRooms(rooms || [])

      setLoading(false)
    }
    loadProfile()
  }, [])

  // Mise à jour instantanée : dès qu'un admin crée/modifie une room, on recharge la liste
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('dashboard-rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        refreshRooms()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  async function refreshRooms() {
    setRefreshing(true)
    const supabase = createClient()
    const { data: rooms } = await supabase
      .from('rooms')
      .select('*, playlists(name)')
      .in('status', ['waiting', 'playing'])
      .order('created_at', { ascending: false })
    setActiveRooms(rooms || [])
    setRefreshing(false)
  }

  async function joinRoom(room) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('room_players').upsert({ room_id: room.id, player_id: user.id, score: 0 }, { onConflict: 'room_id,player_id' })
    if (room.status === 'playing') {
      router.push(`/room/${room.code}/play`)
    } else {
      router.push(`/room/${room.code}`)
    }
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return (
    <main style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui, sans-serif'}}>
      <p style={{color:'#999', fontSize:'14px'}}>Chargement...</p>
    </main>
  )

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#ffffff', fontFamily:'system-ui, sans-serif'}}>
      <style>{`
        .dash-session-clickable { cursor: pointer; transition: background-color 0.15s; }
        .dash-session-clickable:hover { background-color: #f8f8f8; }
        @media (max-width: 768px) {
          .dash-nav { padding: 16px 24px !important; }
          .dash-nav-actions { gap: 8px !important; }
          .dash-pseudo { display: none !important; }
          .dash-container { padding: 24px 16px !important; }
          .dash-profile { flex-direction: column !important; text-align: center !important; padding: 24px !important; gap: 16px !important; }
          .dash-level-bar { max-width: 100% !important; }
          .dash-stats { margin-left: 0 !important; gap: 16px !important; width: 100%; justify-content: center; }
          .dash-room-card { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; padding: 16px !important; }
          .dash-room-btn { width: 100% !important; }
          .dash-session { padding: 12px 14px !important; gap: 12px !important; }
        }
      `}</style>
      <nav className="dash-nav" style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'24px 48px', borderBottom:'1px solid #f0f0f0'}}>
        <a href="/" style={{display:'flex', alignItems:'baseline', gap:'2px', textDecoration:'none'}}>
          <span style={{fontSize:'22px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>obladi</span>
          <span style={{fontSize:'22px', fontWeight:'500', color:'#3b82f6'}}>.</span>
          <span style={{fontSize:'13px', color:'#999'}}>app</span>
        </a>
        <div className="dash-nav-actions" style={{display:'flex', alignItems:'center', gap:'12px'}}>
          <span style={{fontSize:'24px'}}>{AVATARS[profile?.avatar_id] || '🎵'}</span>
          <span className="dash-pseudo" style={{fontSize:'14px', fontWeight:'500', color:'#111'}}>{profile?.pseudo}</span>
          <a href="/profile" style={{fontSize:'13px', color:'#3b82f6', textDecoration:'none', fontWeight:'500'}}>Mon profil →</a>
          <button onClick={handleLogout}
            style={{padding:'6px 14px', backgroundColor:'transparent', border:'1px solid #e0e0e0', borderRadius:'6px', fontSize:'12px', cursor:'pointer', color:'#666'}}>
            Déconnexion
          </button>
        </div>
      </nav>

      <div className="dash-container" style={{maxWidth:'800px', margin:'0 auto', padding:'48px'}}>

        {/* Header profil */}
        <div className="dash-profile" style={{display:'flex', alignItems:'center', gap:'20px', marginBottom:'40px', padding:'32px', backgroundColor:'#f8f8f8', borderRadius:'16px'}}>
          <div style={{fontSize:'56px'}}>{AVATARS[profile?.avatar_id] || '🎵'}</div>
          {(() => {
            const total = profile?.total_score || 0
            const lvl = getLevel(total)
            const isMax = lvl.nextThreshold === null
            const span = isMax ? 0 : lvl.nextThreshold - lvl.currentThreshold
            const progress = isMax ? 100 : Math.min(100, Math.round(((total - lvl.currentThreshold) / span) * 100))
            const remaining = isMax ? 0 : lvl.nextThreshold - total
            return (
              <div style={{flex:1, minWidth:0}}>
                <h1 style={{fontSize:'28px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111', marginBottom:'4px'}}>{profile?.pseudo}</h1>
                <p style={{fontSize:'14px', color:'#666', marginBottom:'12px'}}>{lvl.emoji} {lvl.name}</p>
                <div className="dash-level-bar" style={{maxWidth:'240px'}}>
                  <div style={{height:'4px', borderRadius:'2px', backgroundColor:'#e8e8e8', overflow:'hidden'}}>
                    <div style={{height:'4px', borderRadius:'2px', width:`${progress}%`, backgroundColor:'#3b82f6'}} />
                  </div>
                  <p style={{fontSize:'12px', color:'#999', marginTop:'6px'}}>
                    {isMax ? '🏆 Niveau maximum atteint !' : `${remaining} pts pour le niveau suivant`}
                  </p>
                </div>
              </div>
            )
          })()}
          <div className="dash-stats" style={{marginLeft:'auto', display:'flex', gap:'24px', textAlign:'center'}}>
            <div>
              <p style={{fontSize:'24px', fontWeight:'500', color:'#111'}}>{profile?.games_played || 0}</p>
              <p style={{fontSize:'12px', color:'#999'}}>Parties</p>
            </div>
            <div>
              <p style={{fontSize:'24px', fontWeight:'500', color:'#111'}}>{profile?.best_score || 0}</p>
              <p style={{fontSize:'12px', color:'#999'}}>Meilleur score</p>
            </div>
            <div>
              <p style={{fontSize:'24px', fontWeight:'500', color:'#111'}}>{profile?.total_score || 0}</p>
              <p style={{fontSize:'12px', color:'#999'}}>Score total</p>
            </div>
          </div>
        </div>

        {/* Parties en cours */}
        <div style={{marginBottom:'40px'}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px'}}>
            <h2 style={{fontSize:'18px', fontWeight:'500', color:'#111', letterSpacing:'-0.3px'}}>
              🎵 Parties disponibles
            </h2>
            <button
              onClick={refreshRooms}
              disabled={refreshing}
              style={{padding:'6px 14px', backgroundColor:'transparent', border:'1px solid #e0e0e0', borderRadius:'6px', fontSize:'12px', cursor:'pointer', color:'#666'}}
            >
              {refreshing ? '...' : '↻ Actualiser'}
            </button>
          </div>
          {activeRooms.length === 0 ? (
            <div style={{padding:'24px', border:'1px solid #f0f0f0', borderRadius:'12px', textAlign:'center'}}>
              <p style={{fontSize:'14px', color:'#999'}}>Aucune partie en cours pour le moment.</p>
            </div>
          ) : (
            <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
              {activeRooms.map(room => (
                <div key={room.id} className="dash-room-card" style={{display:'flex', alignItems:'center', gap:'16px', padding:'20px 24px', border:'1px solid #e0e0e0', borderRadius:'12px', backgroundColor: room.status === 'playing' ? '#f0f9ff' : '#fff'}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px'}}>
                      <p style={{fontSize:'15px', fontWeight:'500', color:'#111'}}>{room.title || room.playlists?.name}</p>
                      <span style={{fontSize:'11px', padding:'2px 8px', borderRadius:'99px', backgroundColor: room.status === 'playing' ? '#dcfce7' : '#f0f0f0', color: room.status === 'playing' ? '#16a34a' : '#666'}}>
                        {room.status === 'playing' ? '● En cours' : '⏳ En attente'}
                      </span>
                    </div>
                    <p style={{fontSize:'12px', color:'#999'}}>Code : <strong style={{letterSpacing:'2px', color:'#111'}}>{room.code}</strong></p>
                  </div>
                  <button
                    onClick={() => joinRoom(room)}
                    className="dash-room-btn"
                    style={{padding:'10px 20px', backgroundColor:'#111', color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'500', cursor:'pointer'}}
                  >
                    {room.status === 'playing' ? 'Rejoindre →' : 'Entrer →'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Historique */}
        <div>
          <h2 style={{fontSize:'18px', fontWeight:'500', color:'#111', marginBottom:'16px', letterSpacing:'-0.3px'}}>Mes parties</h2>
          <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
            {sessions.length === 0 ? (
              <div style={{padding:'24px', border:'1px solid #f0f0f0', borderRadius:'12px', textAlign:'center'}}>
                <p style={{fontSize:'14px', color:'#999'}}>Tes parties apparaîtront ici après ta première session.</p>
              </div>
            ) : (
              sessions.map(s => (
                <div key={s.id} className={`dash-session ${s.room_code ? 'dash-session-clickable' : ''}`} onClick={() => s.room_code && router.push(`/room/${s.room_code}/recap`)} style={{display:'flex', alignItems:'center', gap:'16px', padding:'16px 20px', border:'1px solid #f0f0f0', borderRadius:'12px'}}>
                  <div style={{width:'40px', height:'40px', backgroundColor:'#f0f0f0', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0}}>
                    🎵
                  </div>
                  <div style={{flex:1}}>
                    <p style={{fontSize:'14px', fontWeight:'500', color:'#111', marginBottom:'2px'}}>{s.theme || 'Général'}</p>
                    <p style={{fontSize:'12px', color:'#999'}}>{formatDate(s.played_at)}</p>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <p style={{fontSize:'16px', fontWeight:'500', color:'#111'}}>{s.score} pts</p>
                  </div>
                  {s.room_code && <span style={{fontSize:'18px', color:'#ccc', flexShrink:0}}>→</span>}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </main>
  )
}
