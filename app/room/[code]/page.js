'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '../../../lib/supabase'
import { useParams, useRouter } from 'next/navigation'

const AVATARS = { avatar_1:'🎵', avatar_2:'🎸', avatar_3:'🎹', avatar_4:'🥁', avatar_5:'🎺', avatar_6:'🎻', avatar_7:'🎤', avatar_8:'🎧' }

export default function RoomLobby() {
  const { code } = useParams()
  const router = useRouter()
  const [room, setRoom] = useState(null)
  const [players, setPlayers] = useState([])
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState('')
  const roomRef = useRef(null)
  const userRef = useRef(null)

  useEffect(() => {
    let pollInterval
    let channel

    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push(`/login`); return }
      userRef.current = user

      const { data: roomData } = await supabase
        .from('rooms')
        .select('*, playlists(name)')
        .eq('code', code.toUpperCase())
        .single()

      if (!roomData) { setError('Room introuvable'); return }
      setRoom(roomData)
      roomRef.current = roomData

      if (roomData.status === 'playing') {
        router.push(`/room/${code}/play`)
        return
      }

      const { data: existingPlayer } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', roomData.id)
        .eq('player_id', user.id)
        .maybeSingle()
      if (existingPlayer) setJoined(true)

      await refreshPlayers(supabase, roomData.id)

      // Polling toutes les 2 secondes pour les joueurs ET le statut
      pollInterval = setInterval(async () => {
        await refreshPlayers(supabase, roomData.id)

        const { data: freshRoom } = await supabase
          .from('rooms')
          .select('status')
          .eq('id', roomData.id)
          .single()

        if (freshRoom?.status === 'playing') {
          clearInterval(pollInterval)
          router.push(`/room/${code}/play`)
        }
      }, 2000)
    }

    async function refreshPlayers(supabase, roomId) {
      const { data } = await supabase
        .from('room_players')
        .select('*, profiles(pseudo, avatar_id)')
        .eq('room_id', roomId)
      setPlayers(data || [])
    }

    init()
    return () => { clearInterval(pollInterval) }
  }, [code])

  async function joinRoom() {
    const supabase = createClient()
    await supabase.from('room_players').upsert({
      room_id: roomRef.current.id,
      player_id: userRef.current.id,
      score: 0
    }, { onConflict: 'room_id,player_id' })
    setJoined(true)
  }

  async function leaveRoom() {
    const supabase = createClient()
    await supabase.from('room_players')
      .delete()
      .eq('room_id', roomRef.current.id)
      .eq('player_id', userRef.current.id)
    router.push('/dashboard')
  }

  if (error) return (
    <main style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui'}}>
      <div style={{textAlign:'center'}}>
        <p style={{fontSize:'48px', marginBottom:'16px'}}>🎵</p>
        <p style={{fontSize:'18px', fontWeight:'500', color:'#111', marginBottom:'8px'}}>{error}</p>
        <a href="/" style={{fontSize:'14px', color:'#666', textDecoration:'underline'}}>Retour à l'accueil</a>
      </div>
    </main>
  )

  if (!room) return (
    <main style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui'}}>
      <p style={{color:'#999', fontSize:'14px'}}>Chargement...</p>
    </main>
  )

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#fff', fontFamily:'system-ui, sans-serif'}}>
      <nav style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'24px 48px', borderBottom:'1px solid #f0f0f0'}}>
        <a href="/dashboard" style={{display:'flex', alignItems:'baseline', gap:'2px', textDecoration:'none'}}>
          <span style={{fontSize:'22px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>obladi</span>
          <span style={{fontSize:'22px', fontWeight:'500', color:'#3b82f6'}}>.</span>
          <span style={{fontSize:'13px', color:'#999'}}>app</span>
        </a>
        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
          <span style={{fontSize:'13px', color:'#999'}}>Room</span>
          <span style={{fontSize:'16px', fontWeight:'500', letterSpacing:'2px', color:'#111'}}>{code.toUpperCase()}</span>
        </div>
      </nav>

      <div style={{maxWidth:'600px', margin:'0 auto', padding:'48px'}}>
        <div style={{textAlign:'center', marginBottom:'40px'}}>
          <p style={{fontSize:'12px', color:'#999', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'8px'}}>Playlist</p>
          <h1 style={{fontSize:'28px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111', marginBottom:'4px'}}>{room.playlists?.name}</h1>
          <p style={{fontSize:'14px', color:'#999'}}>En attente du lancement par l'admin...</p>
        </div>

        <div style={{marginBottom:'32px'}}>
          <p style={{fontSize:'13px', fontWeight:'500', color:'#111', marginBottom:'12px'}}>{players.length} joueur{players.length > 1 ? 's' : ''} dans le lobby</p>
          <div style={{display:'flex', flexWrap:'wrap', gap:'8px'}}>
            {players.map(p => (
              <div key={p.id} style={{display:'flex', alignItems:'center', gap:'8px', padding:'8px 12px', backgroundColor:'#f8f8f8', borderRadius:'8px'}}>
                <span style={{fontSize:'20px'}}>{AVATARS[p.profiles?.avatar_id] || '🎵'}</span>
                <span style={{fontSize:'13px', fontWeight:'500', color:'#111'}}>{p.profiles?.pseudo}</span>
              </div>
            ))}
          </div>
        </div>

        {!joined ? (
          <button onClick={joinRoom} style={{width:'100%', padding:'14px', backgroundColor:'#111', color:'#fff', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'500', cursor:'pointer'}}>
            Rejoindre la partie
          </button>
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
            <div style={{textAlign:'center', padding:'16px', backgroundColor:'#f0fdf4', borderRadius:'8px', border:'1px solid #dcfce7'}}>
              <p style={{fontSize:'14px', color:'#16a34a', fontWeight:'500'}}>✓ Tu es dans le lobby — attends que l'admin lance la partie !</p>
            </div>
            <button
              onClick={leaveRoom}
              style={{width:'100%', padding:'12px', backgroundColor:'transparent', color:'#999', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'13px', cursor:'pointer'}}
            >
              Quitter la room
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
