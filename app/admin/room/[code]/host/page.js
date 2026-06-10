'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '../../../../../lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { INTRO_DURATION, PLAY_DURATION, REVEAL_DURATION, remainingSeconds } from '../../../../../lib/game'

const AVATARS = { avatar_1:'🎵', avatar_2:'🎸', avatar_3:'🎹', avatar_4:'🥁', avatar_5:'🎺', avatar_6:'🎻', avatar_7:'🎤', avatar_8:'🎧' }

export default function HostRoom() {
  const { code } = useParams()
  const router = useRouter()
  const [room, setRoom] = useState(null)
  const [songs, setSongs] = useState([])
  const [players, setPlayers] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState('waiting')
  const [loading, setLoading] = useState(false)
  const [gamePhase, setGamePhase] = useState('intro')
  const [phaseStartedAt, setPhaseStartedAt] = useState(null)
  const [countdown, setCountdown] = useState(INTRO_DURATION)
  const roomRef = useRef(null)
  const songsRef = useRef([])
  const gamePhaseRef = useRef('intro')
  const phaseStartedAtRef = useRef(null)
  const currentIndexRef = useRef(0)
  const tickFnRef = useRef(null)

  useEffect(() => {
    let pollInterval

    async function init() {
      const supabase = createClient()
      const { data: roomData } = await supabase.from('rooms').select('*, playlists(id, name)').eq('code', code.toUpperCase()).single()
      if (!roomData) return
      setRoom(roomData)
      roomRef.current = roomData
      const startIdx = roomData.current_song_index || 0
      setCurrentIndex(startIdx)
      currentIndexRef.current = startIdx
      setPhase(roomData.status)
      if (roomData.phase && roomData.phase !== 'waiting') {
        setGamePhase(roomData.phase)
        gamePhaseRef.current = roomData.phase
        setPhaseStartedAt(roomData.phase_started_at)
        phaseStartedAtRef.current = roomData.phase_started_at
      }

      const { data: songsData } = await supabase.from('songs').select('*').eq('playlist_id', roomData.playlists.id).order('position', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true })
      setSongs(songsData || [])
      songsRef.current = songsData || []

      await refreshPlayers(supabase, roomData.id)

      pollInterval = setInterval(async () => {
        await refreshPlayers(supabase, roomData.id)
      }, 2000)
    }

    async function refreshPlayers(supabase, roomId) {
      const { data } = await supabase
        .from('room_players')
        .select('*, profiles(pseudo, avatar_id)')
        .eq('room_id', roomId)
        .order('score', { ascending: false })
      setPlayers(data || [])
    }

    init()
    return () => { clearInterval(pollInterval) }
  }, [code])

  useEffect(() => {
    const interval = setInterval(() => {
      if (!phaseStartedAtRef.current) return
      const gp = gamePhaseRef.current
      const duration = gp === 'intro' ? INTRO_DURATION : gp === 'playing' ? PLAY_DURATION : REVEAL_DURATION
      setCountdown(Math.ceil(remainingSeconds(phaseStartedAtRef.current, duration)))
    }, 250)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (phase !== 'playing') return

    async function callTick() {
      const res = await fetch('/api/game-tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_code: code })
      })
      if (!res.ok) return
      const data = await res.json()

      if (data.status === 'finished') {
        setPhase('finished')
        router.push(`/admin/room/${code}/results`)
        return
      }

      if (data.phase && data.phase !== gamePhaseRef.current) {
        gamePhaseRef.current = data.phase
        setGamePhase(data.phase)
      }
      if (data.phase_started_at && data.phase_started_at !== phaseStartedAtRef.current) {
        phaseStartedAtRef.current = data.phase_started_at
        setPhaseStartedAt(data.phase_started_at)
      }
      if (typeof data.current_song_index === 'number' && data.current_song_index !== currentIndexRef.current) {
        currentIndexRef.current = data.current_song_index
        setCurrentIndex(data.current_song_index)
      }
    }

    tickFnRef.current = callTick
    const interval = setInterval(callTick, 500)
    return () => { clearInterval(interval); tickFnRef.current = null }
  }, [phase])

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== 'visible') return
      if (tickFnRef.current) tickFnRef.current()
      // Resync de l'avancement au retour sur l'onglet (même si tickFnRef pas encore prêt)
      fetch('/api/game-tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_code: code })
      }).catch(() => {})
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  async function startGame() {
    setLoading(true)
    const res = await fetch('/api/start-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: roomRef.current.id })
    })
    if (!res.ok) { setLoading(false); return }
    const { phase_started_at } = await res.json()
    gamePhaseRef.current = 'intro'
    phaseStartedAtRef.current = phase_started_at
    currentIndexRef.current = 0
    setPhase('playing')
    setGamePhase('intro')
    setPhaseStartedAt(phase_started_at)
    setCurrentIndex(0)
    setLoading(false)
  }

  async function endGame() {
    const supabase = createClient()
    await supabase.from('rooms').update({ status: 'finished', phase: 'finished' }).eq('id', roomRef.current.id)
    setPhase('finished')
    setLoading(false)
    router.push(`/admin/room/${code}/results`)
  }

  async function interruptGame() {
    if (!confirm('Interrompre la partie ? Les joueurs seront redirigés et la room sera supprimée.')) return
    const supabase = createClient()
    await supabase.from('rooms').update({ status: 'interrupted' }).eq('id', roomRef.current.id)
    await new Promise(r => setTimeout(r, 2000))
    await supabase.from('rooms').delete().eq('id', roomRef.current.id)
    router.push('/admin')
  }

  async function deleteRoom() {
    if (!confirm('Supprimer cette room ?')) return
    const supabase = createClient()
    await supabase.from('rooms').delete().eq('id', roomRef.current.id)
    router.push('/admin')
  }

  const roomUrl = typeof window !== 'undefined' ? `${window.location.origin}/room/${code}` : ''
  const song = songs[currentIndex]
  const readyCount = players.filter(p => p.is_ready).length

  if (!room) return (
    <main style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui'}}>
      <p style={{color:'#999', fontSize:'14px'}}>Chargement...</p>
    </main>
  )

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#fff', fontFamily:'system-ui, sans-serif'}}>
      <style>{`
        @media (max-width: 768px) {
          .host-nav { padding: 16px 24px !important; flex-wrap: wrap !important; gap: 12px !important; }
          .host-grid { grid-template-columns: 1fr !important; padding: 24px 16px !important; gap: 24px !important; }
          .host-songs { max-height: 220px !important; }
        }
      `}</style>
      <nav className="host-nav" style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 48px', borderBottom:'1px solid #f0f0f0'}}>
        <div style={{display:'flex', alignItems:'center', gap:'16px'}}>
          <a href="/admin" style={{fontSize:'14px', color:'#666', textDecoration:'none'}}>← Admin</a>
          <span style={{color:'#e0e0e0'}}>/</span>
          <span style={{fontSize:'15px', fontWeight:'500', color:'#111'}}>Room {code.toUpperCase()}</span>
          <span style={{fontSize:'12px', padding:'3px 10px', borderRadius:'99px', backgroundColor: phase === 'waiting' ? '#f0f0f0' : phase === 'playing' ? '#f0fdf4' : '#fef2f2', color: phase === 'waiting' ? '#666' : phase === 'playing' ? '#16a34a' : '#dc2626'}}>
            {phase === 'waiting' ? 'En attente' : phase === 'playing' ? '● Live' : 'Terminée'}
          </span>
        </div>
        <button onClick={deleteRoom} style={{padding:'6px 14px', backgroundColor:'transparent', border:'1px solid #fee2e2', borderRadius:'6px', fontSize:'12px', cursor:'pointer', color:'#ef4444'}}>
          Supprimer la room
        </button>
      </nav>

      <div className="host-grid" style={{maxWidth:'900px', margin:'0 auto', padding:'32px 48px', display:'grid', gridTemplateColumns:'1fr 280px', gap:'32px'}}>
        <div>
          {phase === 'waiting' && (
            <div style={{padding:'20px', backgroundColor:'#f8f8f8', borderRadius:'12px', marginBottom:'24px'}}>
              <p style={{fontSize:'12px', color:'#999', marginBottom:'8px'}}>Partage ce lien avec tes joueurs</p>
              <div style={{display:'flex', gap:'8px', alignItems:'center', marginBottom:'12px'}}>
                <p style={{fontSize:'13px', color:'#111', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', backgroundColor:'#fff', padding:'8px 12px', borderRadius:'6px', border:'1px solid #e0e0e0'}}>{roomUrl}</p>
                <button onClick={() => navigator.clipboard.writeText(roomUrl)} style={{padding:'8px 16px', backgroundColor:'#111', color:'#fff', border:'none', borderRadius:'6px', fontSize:'12px', cursor:'pointer', flexShrink:0}}>
                  Copier
                </button>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                <span style={{fontSize:'12px', color:'#999'}}>Code :</span>
                <span style={{fontSize:'20px', fontWeight:'500', letterSpacing:'4px', color:'#111'}}>{code.toUpperCase()}</span>
              </div>
            </div>
          )}

          {phase === 'playing' && song && (
            <div style={{padding:'24px', border:'1px solid #e0e0e0', borderRadius:'12px', marginBottom:'24px'}}>
              <p style={{fontSize:'12px', color:'#999', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'0.06em'}}>Question {currentIndex + 1} / {songs.length}</p>
              <div style={{display:'flex', gap:'16px', alignItems:'center'}}>
                {song.cover_url && <img src={song.cover_url} width={64} height={64} style={{borderRadius:'8px'}} referrerPolicy="no-referrer" alt="" />}
                <div>
                  <p style={{fontSize:'20px', fontWeight:'500', color:'#111', marginBottom:'2px'}}>{song.title}</p>
                  <p style={{fontSize:'14px', color:'#666'}}>{song.artist}</p>
                </div>
              </div>
            </div>
          )}

          <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
            {phase === 'waiting' && (
              <>
                <button onClick={startGame} disabled={loading || players.length === 0}
                  style={{width:'100%', padding:'16px', backgroundColor: players.length > 0 ? '#111' : '#ccc', color:'#fff', border:'none', borderRadius:'8px', fontSize:'15px', fontWeight:'500', cursor: players.length > 0 ? 'pointer' : 'default'}}>
                  {loading ? 'Lancement...' : players.length === 0 ? 'En attente de joueurs...' : `🎵 Lancer la partie (${players.length} joueur${players.length > 1 ? 's' : ''})`}
                </button>
                {players.length > 0 && readyCount < players.length && (
                  <p style={{fontSize:'12px', color:'#f59e0b', textAlign:'center', margin:'0'}}>
                    ⚠ {players.length - readyCount} joueur{players.length - readyCount > 1 ? 's' : ''} pas encore prêt{players.length - readyCount > 1 ? 's' : ''}
                  </p>
                )}
              </>
            )}
            {phase === 'playing' && (
              <>
                <div style={{padding:'20px', backgroundColor:'#f8f8f8', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                  <div>
                    <p style={{fontSize:'12px', color:'#999', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'4px'}}>
                      {gamePhase === 'intro' ? 'Intro' : gamePhase === 'playing' ? 'Écoute' : 'Révélation'}
                    </p>
                    <p style={{fontSize:'14px', fontWeight:'500', color:'#111'}}>{gamePhase === 'intro' ? 'Compte à rebours lancement' : `Morceau ${currentIndex + 1} / ${songs.length}`}</p>
                  </div>
                  <div>
                    <span style={{fontSize:'48px', fontWeight:'500', color: countdown <= 5 ? '#ef4444' : '#111'}}>{countdown}</span>
                    <span style={{fontSize:'14px', color:'#999', marginLeft:'2px'}}>s</span>
                  </div>
                </div>
                <button onClick={endGame}
                  style={{width:'100%', padding:'12px', backgroundColor:'transparent', color:'#3b82f6', border:'1px solid #bfdbfe', borderRadius:'8px', fontSize:'13px', cursor:'pointer'}}>
                  ✓ Clore la partie maintenant (résultats affichés)
                </button>
                <button onClick={interruptGame}
                  style={{width:'100%', padding:'12px', backgroundColor:'transparent', color:'#ef4444', border:'1px solid #fee2e2', borderRadius:'8px', fontSize:'13px', cursor:'pointer'}}>
                  ✗ Interrompre la partie (pas de résultats)
                </button>
              </>
            )}
          </div>

          <div style={{marginTop:'32px'}}>
            <p style={{fontSize:'13px', fontWeight:'500', color:'#111', marginBottom:'12px'}}>Playlist — {room.playlists?.name}</p>
            <div className="host-songs" style={{border:'1px solid #f0f0f0', borderRadius:'8px', overflow:'hidden', maxHeight:'300px', overflowY:'auto'}}>
              {songs.map((s, i) => (
                <div key={s.id} style={{display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', borderBottom:'1px solid #f8f8f8', backgroundColor: i === currentIndex && phase === 'playing' ? '#f0f9ff' : 'transparent'}}>
                  <span style={{fontSize:'12px', color:'#999', width:'20px'}}>{i + 1}</span>
                  {s.cover_url && <img src={s.cover_url} width={28} height={28} style={{borderRadius:'4px'}} referrerPolicy="no-referrer" alt="" />}
                  <div style={{flex:1, minWidth:0}}>
                    <p style={{fontSize:'12px', fontWeight: i === currentIndex ? '500' : '400', color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.title}</p>
                    <p style={{fontSize:'11px', color:'#999'}}>{s.artist}</p>
                  </div>
                  {i < currentIndex && <span style={{fontSize:'11px', color:'#999'}}>✓</span>}
                  {i === currentIndex && phase === 'playing' && <span style={{fontSize:'11px', color:'#3b82f6'}}>● En cours</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p style={{fontSize:'13px', fontWeight:'500', color:'#111', marginBottom:'12px'}}>
            {players.length} joueur{players.length > 1 ? 's' : ''}{players.length > 0 && (
              <span style={{fontWeight:'400', color: readyCount === players.length ? '#16a34a' : '#999'}}> — {readyCount}/{players.length} prêts</span>
            )}
          </p>
          <div style={{display:'flex', flexDirection:'column', gap:'6px'}}>
            {players.length === 0 && (
              <p style={{fontSize:'13px', color:'#999', padding:'16px', textAlign:'center', border:'1px solid #f0f0f0', borderRadius:'8px'}}>En attente de joueurs...</p>
            )}
            {players.map((p, i) => (
              <div key={p.id} style={{display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', backgroundColor:'#f8f8f8', borderRadius:'8px', border: p.is_ready ? '1px solid #dcfce7' : '1px solid transparent'}}>
                <span style={{fontSize:'12px', color:'#999', width:'16px'}}>{i + 1}</span>
                <span style={{fontSize:'20px'}}>{AVATARS[p.profiles?.avatar_id] || '🎵'}</span>
                <div style={{flex:1}}>
                  <p style={{fontSize:'13px', fontWeight:'500', color:'#111'}}>{p.profiles?.pseudo}</p>
                  <p style={{fontSize:'11px', color:'#999'}}>{p.score} pts</p>
                </div>
                <span style={{fontSize:'13px', color: p.is_ready ? '#16a34a' : '#ccc'}} title={p.is_ready ? 'Prêt' : 'Pas prêt'}>
                  {p.is_ready ? '✓' : '○'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
