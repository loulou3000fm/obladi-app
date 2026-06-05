'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '../../../../lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { INTRO_DURATION, PLAY_DURATION, REVEAL_DURATION, remainingSeconds } from '../../../../lib/game'

const AVATARS = { avatar_1:'🎵', avatar_2:'🎸', avatar_3:'🎹', avatar_4:'🥁', avatar_5:'🎺', avatar_6:'🎻', avatar_7:'🎤', avatar_8:'🎧' }

export default function Play() {
  const { code } = useParams()
  const router = useRouter()
  const [room, setRoom] = useState(null)
  const [songs, setSongs] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [players, setPlayers] = useState([])
  const [gamePhase, setGamePhase] = useState('intro')
  const [countdown, setCountdown] = useState(INTRO_DURATION)
  const roomRef = useRef(null)
  const songsRef = useRef([])
  const currentIndexRef = useRef(0)
  const gamePhaseRef = useRef('intro')
  const phaseStartedAtRef = useRef(null)

  useEffect(() => {
    let pollInterval

    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: roomData } = await supabase.from('rooms').select('*, playlists(id, name)').eq('code', code.toUpperCase()).single()
      if (!roomData) return
      setRoom(roomData)
      roomRef.current = roomData

      const startIndex = roomData.current_song_index || 0
      setCurrentIndex(startIndex)
      currentIndexRef.current = startIndex

      const startPhase = roomData.phase || 'intro'
      setGamePhase(startPhase)
      gamePhaseRef.current = startPhase
      phaseStartedAtRef.current = roomData.phase_started_at

      const { data: songsData } = await supabase.from('songs').select('*').eq('playlist_id', roomData.playlists.id).order('created_at')
      songsRef.current = songsData || []
      setSongs(songsData || [])

      const { data: playersData } = await supabase.from('room_players').select('*, profiles(pseudo, avatar_id)').eq('room_id', roomData.id).order('score', { ascending: false })
      setPlayers(playersData || [])

      pollInterval = setInterval(async () => {
        const { data: freshRoom } = await supabase.from('rooms').select('status, current_song_index, phase, phase_started_at').eq('id', roomData.id).single()
        if (!freshRoom) return

        if (freshRoom.status === 'finished') { clearInterval(pollInterval); router.push(`/room/${code}/results`); return }
        if (freshRoom.status === 'interrupted') { clearInterval(pollInterval); router.push(`/room/${code}/interrupted`); return }

        if (freshRoom.phase !== gamePhaseRef.current) {
          gamePhaseRef.current = freshRoom.phase
          setGamePhase(freshRoom.phase)
        }
        if (freshRoom.phase_started_at !== phaseStartedAtRef.current) {
          phaseStartedAtRef.current = freshRoom.phase_started_at
        }
        if (freshRoom.current_song_index !== currentIndexRef.current) {
          currentIndexRef.current = freshRoom.current_song_index
          setCurrentIndex(freshRoom.current_song_index)
        }

        const { data: freshPlayers } = await supabase.from('room_players').select('*, profiles(pseudo, avatar_id)').eq('room_id', roomData.id).order('score', { ascending: false })
        setPlayers(freshPlayers || [])
      }, 2000)
    }

    init()
    return () => { clearInterval(pollInterval) }
  }, [code])

  useEffect(() => {
    const interval = setInterval(() => {
      const gp = gamePhaseRef.current
      const duration = gp === 'intro' ? INTRO_DURATION : gp === 'playing' ? PLAY_DURATION : REVEAL_DURATION
      setCountdown(Math.ceil(remainingSeconds(phaseStartedAtRef.current, duration)))
    }, 250)
    return () => clearInterval(interval)
  }, [])

  if (!room || songsRef.current.length === 0) return (
    <main style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui'}}>
      <p style={{color:'#999', fontSize:'14px'}}>Chargement...</p>
    </main>
  )

  const totalSongs = songsRef.current.length
  const maxDuration = gamePhase === 'intro' ? INTRO_DURATION : gamePhase === 'playing' ? PLAY_DURATION : REVEAL_DURATION

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#fff', fontFamily:'system-ui, sans-serif', display:'flex', flexDirection:'column'}}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 32px', borderBottom:'1px solid #f0f0f0'}}>
        <div style={{display:'flex', alignItems:'baseline', gap:'2px'}}>
          <span style={{fontSize:'18px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>obladi</span>
          <span style={{fontSize:'18px', fontWeight:'500', color:'#3b82f6'}}>.</span>
        </div>
        <a href="/dashboard" style={{fontSize:'13px', color:'#999', textDecoration:'none', marginRight:'auto', marginLeft:'16px'}}>← Quitter</a>
        <span style={{fontSize:'13px', color:'#999'}}>Morceau {currentIndex + 1} / {totalSongs}</span>
      </div>

      <div style={{height:'3px', backgroundColor:'#f0f0f0'}}>
        <div style={{height:'3px', backgroundColor:'#3b82f6', width:`${Math.round((countdown / maxDuration) * 100)}%`, transition:'width 0.25s linear'}} />
      </div>

      <div style={{flex:1, display:'flex', overflow:'hidden'}}>
        <div style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'48px'}}>

          {gamePhase === 'intro' && (
            <>
              <div style={{fontSize:'72px', marginBottom:'24px'}}>🎵</div>
              <h1 style={{fontSize:'40px', fontWeight:'500', letterSpacing:'-1px', color:'#111', textAlign:'center', marginBottom:'16px', lineHeight:'1.1'}}>
                Vous êtes prêts ?<br />Ça va commencer !
              </h1>
              <div style={{fontSize:'64px', fontWeight:'500', color: countdown <= 5 ? '#ef4444' : '#111', marginTop:'32px'}}>
                {countdown}<span style={{fontSize:'20px', color:'#999', fontWeight:'400', marginLeft:'4px'}}>s</span>
              </div>
            </>
          )}

          {gamePhase === 'playing' && (
            <>
              <p style={{fontSize:'12px', color:'#999', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'24px'}}>Morceau {currentIndex + 1} / {totalSongs}</p>
              <div style={{width:'120px', height:'120px', backgroundColor:'#f0f0f0', borderRadius:'16px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'48px', marginBottom:'32px'}}>🎵</div>
              <div style={{fontSize:'64px', fontWeight:'500', color: countdown <= 5 ? '#ef4444' : '#111'}}>
                {countdown}<span style={{fontSize:'20px', color:'#999', fontWeight:'400', marginLeft:'4px'}}>s</span>
              </div>
              <p style={{fontSize:'13px', color:'#bbb', marginTop:'24px', fontStyle:'italic'}}>— audio à venir —</p>
            </>
          )}

          {gamePhase === 'reveal' && (
            <>
              <p style={{fontSize:'12px', color:'#999', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'24px'}}>Révélation</p>
              <div style={{fontSize:'64px', marginBottom:'24px'}}>🎤</div>
              <p style={{fontSize:'18px', color:'#999', fontStyle:'italic', marginBottom:'32px'}}>— résultats à venir —</p>
              <div style={{fontSize:'48px', fontWeight:'500', color: countdown <= 2 ? '#ef4444' : '#999'}}>
                {countdown}<span style={{fontSize:'16px', fontWeight:'400', marginLeft:'4px'}}>s</span>
              </div>
            </>
          )}

        </div>

        <div style={{width:'220px', borderLeft:'1px solid #f0f0f0', padding:'24px 16px', overflowY:'auto'}}>
          <p style={{fontSize:'12px', fontWeight:'500', color:'#999', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'16px'}}>Classement</p>
          {players.map((p, i) => (
            <div key={p.id} style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px'}}>
              <span style={{fontSize:'12px', color:'#999', width:'16px'}}>{i+1}</span>
              <span style={{fontSize:'16px'}}>{AVATARS[p.profiles?.avatar_id] || '🎵'}</span>
              <div style={{flex:1, minWidth:0}}>
                <p style={{fontSize:'12px', fontWeight:'500', color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{p.profiles?.pseudo}</p>
                <p style={{fontSize:'11px', color:'#999'}}>{p.score} pts</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
