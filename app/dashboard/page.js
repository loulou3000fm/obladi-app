'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '../../lib/supabase'
import { getLevel } from '../../lib/game'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
  const [pendingFriends, setPendingFriends] = useState(0)
  const [friendsInGame, setFriendsInGame] = useState([])
  const [favorites, setFavorites] = useState([])
  const viewerIdRef = useRef(null)
  const router = useRouter()

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      viewerIdRef.current = user.id

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

      const { count: pending } = await supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('addressee_id', user.id)
      setPendingFriends(pending || 0)

      const { data: favRows } = await supabase.from('favorites').select('song_id, created_at').eq('player_id', user.id).order('created_at', { ascending: false }).limit(10)
      if (favRows && favRows.length) {
        const ids = favRows.map(f => f.song_id)
        const { data: favSongs } = await supabase.from('songs').select('id, title, artist, cover_url').in('id', ids)
        const map = {}
        for (const s of (favSongs || [])) map[s.id] = s
        setFavorites(ids.map(id => map[id]).filter(Boolean))
      } else {
        setFavorites([])
      }

      await loadFriendsInGame(user.id)

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
        loadFriendsInGame(viewerIdRef.current)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Filet de secours : le Realtime est peu fiable sur mobile (websocket throttlé/suspendu),
  // donc on rafraîchit la liste des parties ET l'encart amis toutes les 10s.
  useEffect(() => {
    const interval = setInterval(() => {
      refreshRooms()
      loadFriendsInGame(viewerIdRef.current)
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  // Au retour sur la page (crucial sur mobile : l'app est souvent quittée/reprise)
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      refreshRooms()
      loadFriendsInGame(viewerIdRef.current)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
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

  // Encart "Tes amis" : amis actuellement dans une room waiting/playing récente
  async function loadFriendsInGame(viewerId) {
    if (!viewerId) return
    try {
      const supabase = createClient()
      const { data: fr } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${viewerId},addressee_id.eq.${viewerId}`)
      const friendIds = (fr || []).map(f => f.requester_id === viewerId ? f.addressee_id : f.requester_id)
      if (friendIds.length === 0) { setFriendsInGame([]); return }

      const cutoff = Date.now() - 6 * 60 * 60 * 1000
      const { data: rps } = await supabase
        .from('room_players')
        .select('player_id, rooms(id, code, title, status, created_at)')
        .in('player_id', friendIds)

      const valid = (rps || []).filter(rp =>
        rp.rooms &&
        (rp.rooms.status === 'waiting' || rp.rooms.status === 'playing') &&
        new Date(rp.rooms.created_at).getTime() >= cutoff
      )
      if (valid.length === 0) { setFriendsInGame([]); return }

      const presentIds = [...new Set(valid.map(rp => rp.player_id))]
      const { data: profs } = await supabase.from('profiles').select('id, pseudo, avatar_id, total_score').in('id', presentIds)
      const profileMap = {}
      for (const p of (profs || [])) profileMap[p.id] = p

      const byRoom = {}
      for (const rp of valid) {
        const r = rp.rooms
        if (!byRoom[r.id]) byRoom[r.id] = { ...r, friends: [] }
        byRoom[r.id].friends.push(profileMap[rp.player_id] || { id: rp.player_id, pseudo: 'Joueur', avatar_id: null, total_score: 0 })
      }
      setFriendsInGame(Object.values(byRoom))
    } catch {
      // silencieux : l'encart disparaît simplement en cas d'erreur
    }
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
        .fg-link:hover { text-decoration: underline; }
        @media (max-width: 768px) {
          .friends-game-card { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; padding: 16px !important; }
          .fg-join { width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
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
          <a href="/friends" style={{position:'relative', fontSize:'13px', color:'#3b82f6', textDecoration:'none', fontWeight:'500'}}>
            Amis
            {pendingFriends > 0 && (
              <span style={{position:'absolute', top:'-8px', right:'-12px', backgroundColor:'#ef4444', color:'#fff', fontSize:'10px', fontWeight:'600', minWidth:'16px', height:'16px', borderRadius:'99px', display:'inline-flex', alignItems:'center', justifyContent:'center', padding:'0 4px', boxSizing:'border-box'}}>{pendingFriends}</span>
            )}
          </a>
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

        {/* Tes amis en jeu */}
        {friendsInGame.length > 0 && (
          <div style={{marginBottom:'40px'}}>
            <h2 style={{fontSize:'18px', fontWeight:'500', color:'#111', marginBottom:'16px', letterSpacing:'-0.3px'}}>👥 Tes amis</h2>
            <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
              {friendsInGame.map(room => (
                <div key={room.id} className="friends-game-card" style={{display:'flex', alignItems:'center', gap:'16px', padding:'20px 24px', border:'1px solid #e0e0e0', borderRadius:'12px'}}>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px', flexWrap:'wrap'}}>
                      <p style={{fontSize:'15px', fontWeight:'500', color:'#111'}}>{room.title || 'Partie'}</p>
                      <span style={{fontSize:'11px', padding:'2px 8px', borderRadius:'99px', backgroundColor: room.status === 'waiting' ? '#eff6ff' : '#f0f0f0', color: room.status === 'waiting' ? '#3b82f6' : '#666'}}>
                        {room.status === 'waiting' ? 'En attente' : 'En cours'}
                      </span>
                    </div>
                    <div style={{display:'flex', flexWrap:'wrap', gap:'12px'}}>
                      {room.friends.map(f => (
                        <Link key={f.id} href={`/player/${f.id}`} className="fg-link" style={{display:'flex', alignItems:'center', gap:'6px', textDecoration:'none', color:'inherit'}}>
                          <span style={{fontSize:'18px'}}>{AVATARS[f.avatar_id] || '🎵'}</span>
                          <span style={{fontSize:'13px', fontWeight:'500', color:'#111'}}>{f.pseudo}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                  {room.status === 'waiting' ? (
                    <Link href={`/room/${room.code}`} className="fg-join" style={{padding:'10px 20px', backgroundColor:'#3b82f6', color:'#fff', borderRadius:'8px', fontSize:'13px', fontWeight:'500', textDecoration:'none', flexShrink:0, whiteSpace:'nowrap'}}>
                      Rejoindre →
                    </Link>
                  ) : (
                    <span style={{fontSize:'13px', color:'#999', flexShrink:0}}>en partie</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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

        {/* Tes favoris */}
        <div style={{marginBottom:'40px'}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px'}}>
            <h2 style={{fontSize:'18px', fontWeight:'500', color:'#111', letterSpacing:'-0.3px'}}>❤️ Tes favoris</h2>
            {favorites.length > 0 && <a href="/favorites" style={{fontSize:'13px', color:'#3b82f6', textDecoration:'none', fontWeight:'500'}}>Voir tout →</a>}
          </div>
          {favorites.length === 0 ? (
            <div style={{padding:'24px', border:'1px solid #f0f0f0', borderRadius:'12px', textAlign:'center'}}>
              <p style={{fontSize:'14px', color:'#999'}}>Mets des morceaux en favori pendant une partie pour les retrouver ici.</p>
            </div>
          ) : (
            <div style={{display:'flex', gap:'12px', overflowX:'auto', paddingBottom:'4px'}}>
              {favorites.map(s => (
                <div key={s.id} style={{width:'110px', flexShrink:0}}>
                  {s.cover_url
                    ? <img src={s.cover_url} width={110} height={110} style={{width:'110px', height:'110px', borderRadius:'10px', objectFit:'cover'}} referrerPolicy="no-referrer" alt="" />
                    : <div style={{width:'110px', height:'110px', backgroundColor:'#f0f0f0', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'32px'}}>🎵</div>
                  }
                  <p style={{fontSize:'13px', fontWeight:'500', color:'#111', margin:'8px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.title}</p>
                  <p style={{fontSize:'12px', color:'#999', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.artist}</p>
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
