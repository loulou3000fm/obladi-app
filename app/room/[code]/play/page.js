'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '../../../../lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { checkAnswer, calculatePoints } from '../../../../lib/game'

const AVATARS = { avatar_1:'🎵', avatar_2:'🎸', avatar_3:'🎹', avatar_4:'🥁', avatar_5:'🎺', avatar_6:'🎻', avatar_7:'🎤', avatar_8:'🎧' }

export default function Play() {
  const { code } = useParams()
  const router = useRouter()
  const [room, setRoom] = useState(null)
  const [songs, setSongs] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [profile, setProfile] = useState(null)
  const [artistAnswer, setArtistAnswer] = useState('')
  const [titleAnswer, setTitleAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState(null)
  const [timeLeft, setTimeLeft] = useState(30)
  const [players, setPlayers] = useState([])
  const [phase, setPhase] = useState('playing')
  const [myScore, setMyScore] = useState(0)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [currentSong, setCurrentSong] = useState(null)
  const timerRef = useRef(null)
  const roomRef = useRef(null)
  const songsRef = useRef([])
  const currentIndexRef = useRef(0)
  const submittedRef = useRef(false)
  const myScoreRef = useRef(0)
  const timeLeftRef = useRef(30)

  useEffect(() => {
    let pollInterval

    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: roomData } = await supabase.from('rooms').select('*, playlists(id, name)').eq('code', code.toUpperCase()).single()
      if (!roomData) return
      setRoom(roomData)
      roomRef.current = roomData
      const startIndex = roomData.current_song_index || 0
      setCurrentIndex(startIndex)
      currentIndexRef.current = startIndex

      const { data: songsData } = await supabase.from('songs').select('*').eq('playlist_id', roomData.playlists.id).order('created_at')
      songsRef.current = songsData || []
      setSongs(songsData || [])

      const { data: myPlayer } = await supabase.from('room_players').select('score').eq('room_id', roomData.id).eq('player_id', user.id).maybeSingle()
      if (myPlayer) { setMyScore(myPlayer.score); myScoreRef.current = myPlayer.score }

      const { data: playersData } = await supabase.from('room_players').select('*, profiles(pseudo, avatar_id)').eq('room_id', roomData.id).order('score', { ascending: false })
      setPlayers(playersData || [])

      pollInterval = setInterval(async () => {
        const { data: freshRoom } = await supabase.from('rooms').select('status, current_song_index').eq('id', roomData.id).single()
        if (!freshRoom) return

        if (freshRoom.status === 'finished') {
          clearInterval(pollInterval)
          router.push(`/room/${code}/results`)
          return
        }

        if (freshRoom.status === 'interrupted') {
          clearInterval(pollInterval)
          router.push(`/room/${code}/interrupted`)
          return
        }

        if (freshRoom.current_song_index !== currentIndexRef.current) {
          currentIndexRef.current = freshRoom.current_song_index
          setCurrentIndex(freshRoom.current_song_index)
          submittedRef.current = false
          setSubmitted(false)
          setResult(null)
          setArtistAnswer('')
          setTitleAnswer('')
          timeLeftRef.current = 30
          setTimeLeft(30)
          setPhase('playing')
        }

        const { data: freshPlayers } = await supabase.from('room_players').select('*, profiles(pseudo, avatar_id)').eq('room_id', roomData.id).order('score', { ascending: false })
        setPlayers(freshPlayers || [])
      }, 2000)
    }

    init()
    return () => { clearInterval(pollInterval) }
  }, [code])

  useEffect(() => {
    if (!audioUnlocked) return
    if (songsRef.current.length === 0) return
    const song = songsRef.current[currentIndex]
    if (!song) return
    setCurrentSong(song)
  }, [currentIndex, audioUnlocked, songs])

  useEffect(() => {
    if (phase !== 'playing' || submittedRef.current) return
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      timeLeftRef.current -= 1
      setTimeLeft(timeLeftRef.current)
      if (timeLeftRef.current <= 0) {
        clearInterval(timerRef.current)
        if (!submittedRef.current) handleSubmit(true)
      }
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [phase, currentIndex])

  function unlockAudio() {
    setAudioUnlocked(true)
  }

  async function handleSubmit(auto = false) {
    if (submittedRef.current) return
    const songs = songsRef.current
    const idx = currentIndexRef.current
    if (!songs || songs.length === 0 || idx >= songs.length) return
    const song = songs[idx]
    if (!song) return

    submittedRef.current = true
    setSubmitted(true)
    clearInterval(timerRef.current)
    setCurrentSong(prev => ({...prev, youtube_id: null}))

    const artistOk = checkAnswer(artistAnswer, song.artist)
    const titleOk = checkAnswer(titleAnswer, song.title)
    const points = calculatePoints(artistOk, timeLeftRef.current) + calculatePoints(titleOk, timeLeftRef.current)

    setResult({ artistOk, titleOk, points, song })
    setPhase('reveal')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('answers').insert({
      room_id: roomRef.current.id,
      player_id: user.id,
      song_id: song.id,
      artist_answer: artistAnswer || '',
      title_answer: titleAnswer || '',
      artist_correct: artistOk,
      title_correct: titleOk,
      points
    })

    if (points > 0) {
      const newScore = myScoreRef.current + points
      myScoreRef.current = newScore
      setMyScore(newScore)
      await supabase.from('room_players').update({ score: newScore }).eq('room_id', roomRef.current.id).eq('player_id', user.id)
    }
  }

  if (!audioUnlocked) return (
    <main style={{minHeight:'100vh', backgroundColor:'#fff', fontFamily:'system-ui, sans-serif', display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{textAlign:'center', maxWidth:'400px', padding:'48px'}}>
        <div style={{fontSize:'64px', marginBottom:'24px'}}>🎵</div>
        <h1 style={{fontSize:'24px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111', marginBottom:'8px'}}>La partie commence !</h1>
        <p style={{fontSize:'14px', color:'#666', marginBottom:'32px', lineHeight:'1.6'}}>Clique pour activer l'audio et démarrer le blindtest. Monte le son !</p>
        <button onClick={unlockAudio} style={{width:'100%', padding:'16px', backgroundColor:'#111', color:'#fff', border:'none', borderRadius:'8px', fontSize:'16px', fontWeight:'500', cursor:'pointer'}}>
          🎧 Démarrer le blindtest
        </button>
      </div>
    </main>
  )

  if (!room || songsRef.current.length === 0) return (
    <main style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui'}}>
      <p style={{color:'#999', fontSize:'14px'}}>Chargement...</p>
    </main>
  )

  const song = songsRef.current[currentIndex]

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#fff', fontFamily:'system-ui, sans-serif', display:'flex', flexDirection:'column'}}>
      {currentSong?.youtube_id && phase === 'playing' && (
        <div style={{position:'fixed', top:'-9999px', left:'-9999px', width:'1px', height:'1px', overflow:'hidden'}}>
          <iframe
            key={currentSong.youtube_id}
            width="1"
            height="1"
            src={`https://www.youtube.com/embed/${currentSong.youtube_id}?autoplay=1&controls=0&mute=0`}
            allow="autoplay"
            title="audio-player"
          />
        </div>
      )}

      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 32px', borderBottom:'1px solid #f0f0f0'}}>
        <div style={{display:'flex', alignItems:'baseline', gap:'2px'}}>
          <span style={{fontSize:'18px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>obladi</span>
          <span style={{fontSize:'18px', fontWeight:'500', color:'#3b82f6'}}>.</span>
        </div>
        <a href="/dashboard" style={{fontSize:'13px', color:'#999', textDecoration:'none', marginRight:'auto', marginLeft:'16px'}}>← Quitter</a>
        <div style={{display:'flex', alignItems:'center', gap:'16px'}}>
          <span style={{fontSize:'13px', color:'#999'}}>Question {currentIndex + 1}/{songsRef.current.length}</span>
          <span style={{fontSize:'13px', fontWeight:'500', color:'#111'}}>Score : {myScore} pts</span>
        </div>
        <div style={{fontSize:'28px', fontWeight:'500', color: timeLeft <= 5 ? '#ef4444' : '#111', minWidth:'48px', textAlign:'center'}}>
          {phase === 'playing' ? timeLeft : '⏱'}
        </div>
      </div>

      <div style={{height:'3px', backgroundColor:'#f0f0f0'}}>
        <div style={{height:'3px', backgroundColor:'#3b82f6', width:`${(timeLeft/30)*100}%`, transition:'width 1s linear'}} />
      </div>

      <div style={{flex:1, display:'flex', overflow:'hidden'}}>
        <div style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'48px'}}>

          {phase === 'playing' && (
            <>
              <div style={{width:'120px', height:'120px', backgroundColor:'#f0f0f0', borderRadius:'16px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'48px', marginBottom:'32px'}}>
                🎵
              </div>
              <p style={{fontSize:'14px', color:'#999', marginBottom:'24px'}}>Qui chante ? Quel titre ?</p>
              <div style={{width:'100%', maxWidth:'400px', display:'flex', flexDirection:'column', gap:'12px'}}>
                <input
                  value={artistAnswer}
                  onChange={e => setArtistAnswer(e.target.value)}
                  placeholder="Artiste..."
                  style={{width:'100%', padding:'14px 16px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'16px', outline:'none', color:'#111', boxSizing:'border-box'}}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  autoFocus
                />
                <input
                  value={titleAnswer}
                  onChange={e => setTitleAnswer(e.target.value)}
                  placeholder="Titre..."
                  style={{width:'100%', padding:'14px 16px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'16px', outline:'none', color:'#111', boxSizing:'border-box'}}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
                <button
                  onClick={() => handleSubmit()}
                  disabled={!artistAnswer && !titleAnswer}
                  style={{width:'100%', padding:'14px', backgroundColor: (artistAnswer || titleAnswer) ? '#111' : '#ccc', color:'#fff', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'500', cursor: (artistAnswer || titleAnswer) ? 'pointer' : 'default'}}
                >
                  Valider →
                </button>
              </div>
            </>
          )}

          {phase === 'reveal' && result && (
            <div style={{width:'100%', maxWidth:'500px', textAlign:'center'}}>
              <div style={{marginBottom:'24px'}}>
                <div style={{fontSize:'48px', marginBottom:'8px'}}>{result.points > 0 ? '🎉' : '😅'}</div>
                <div style={{fontSize:'36px', fontWeight:'500', color:'#111', marginBottom:'4px'}}>+{result.points} pts</div>
              </div>
              <div style={{padding:'20px', backgroundColor:'#f8f8f8', borderRadius:'12px', marginBottom:'20px', textAlign:'left'}}>
                <p style={{fontSize:'12px', color:'#999', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.06em'}}>La bonne réponse</p>
                <p style={{fontSize:'18px', fontWeight:'500', color:'#111', marginBottom:'2px'}}>{result.song.title}</p>
                <p style={{fontSize:'14px', color:'#666'}}>{result.song.artist}</p>
              </div>
              <div style={{display:'flex', gap:'8px', marginBottom:'20px'}}>
                <div style={{flex:1, padding:'12px', backgroundColor: result.artistOk ? '#f0fdf4' : '#fef2f2', borderRadius:'8px', border:`1px solid ${result.artistOk ? '#dcfce7' : '#fee2e2'}`}}>
                  <p style={{fontSize:'12px', color: result.artistOk ? '#16a34a' : '#dc2626', marginBottom:'2px'}}>{result.artistOk ? '✓ Artiste' : '✗ Artiste'}</p>
                  <p style={{fontSize:'13px', color:'#666'}}>{artistAnswer || '—'}</p>
                </div>
                <div style={{flex:1, padding:'12px', backgroundColor: result.titleOk ? '#f0fdf4' : '#fef2f2', borderRadius:'8px', border:`1px solid ${result.titleOk ? '#dcfce7' : '#fee2e2'}`}}>
                  <p style={{fontSize:'12px', color: result.titleOk ? '#16a34a' : '#dc2626', marginBottom:'2px'}}>{result.titleOk ? '✓ Titre' : '✗ Titre'}</p>
                  <p style={{fontSize:'13px', color:'#666'}}>{titleAnswer || '—'}</p>
                </div>
              </div>
              {result.song.youtube_id && (
                <div style={{borderRadius:'12px', overflow:'hidden', marginBottom:'16px'}}>
                  <iframe width="100%" height="200" src={`https://www.youtube.com/embed/${result.song.youtube_id}?autoplay=1`} allow="autoplay" style={{border:'none', display:'block'}} />
                </div>
              )}
              <p style={{fontSize:'13px', color:'#999'}}>En attente de la prochaine question...</p>
            </div>
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
