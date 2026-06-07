'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '../../../../lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { INTRO_DURATION, PLAY_DURATION, REVEAL_DURATION, remainingSeconds, checkAnswer, closeAnswer, getLevel } from '../../../../lib/game'

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
  const [artistAnswer, setArtistAnswer] = useState('')
  const [titleAnswer, setTitleAnswer] = useState('')
  const [artistFeedback, setArtistFeedback] = useState(null)
  const [titleFeedback, setTitleFeedback] = useState(null)
  const [frozen, setFrozen] = useState(false)
  const [result, setResult] = useState(null)
  const [myScore, setMyScore] = useState(0)
  const [pastResults, setPastResults] = useState([])
  const [correctArtistCount, setCorrectArtistCount] = useState(0)
  const [correctTitleCount, setCorrectTitleCount] = useState(0)
  const roomRef = useRef(null)
  const songsRef = useRef([])
  const currentIndexRef = useRef(0)
  const gamePhaseRef = useRef('intro')
  const phaseStartedAtRef = useRef(null)
  const userRef = useRef(null)
  const artistAnswerRef = useRef('')
  const titleAnswerRef = useRef('')
  const hasSubmittedRef = useRef(false)
  const pendingPointsRef = useRef(0)
  const artistDebounceRef = useRef(null)
  const titleDebounceRef = useRef(null)
  const myScoreRef = useRef(0)
  const pollFnRef = useRef(null)
  const pollTimeoutRef = useRef(null)

  useEffect(() => {
    let stopped = false

    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      userRef.current = user

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

      const { data: songsData } = await supabase.from('songs').select('*').eq('playlist_id', roomData.playlists.id).order('position', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true })
      songsRef.current = songsData || []
      setSongs(songsData || [])

      const { data: myPlayer } = await supabase.from('room_players').select('score').eq('room_id', roomData.id).eq('player_id', user.id).maybeSingle()
      if (myPlayer) { setMyScore(myPlayer.score || 0); myScoreRef.current = myPlayer.score || 0 }

      const { data: playersData } = await supabase.from('room_players').select('*, profiles(pseudo, avatar_id, total_score)').eq('room_id', roomData.id).order('score', { ascending: false })
      setPlayers(playersData || [])

      async function doPoll() {
        if (!roomRef.current) { if (!stopped) pollTimeoutRef.current = setTimeout(doPoll, 500); return }
        const response = await fetch(`/api/room-state?code=${roomRef.current.code}`, { cache: 'no-store' })
        const freshRoom = await response.json()
        if (!freshRoom) { if (!stopped) pollTimeoutRef.current = setTimeout(doPoll, 500); return }

        if (freshRoom.status === 'finished') { stopped = true; router.push(`/room/${code}/results`); return }
        if (freshRoom.status === 'interrupted') { stopped = true; router.push(`/room/${code}/interrupted`); return }

        if (freshRoom.status === 'playing' && ['intro', 'playing', 'reveal'].includes(freshRoom.phase)) {
          fetch('/api/game-tick', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_code: roomRef.current.code })
          }).catch(() => {})
        }

        phaseStartedAtRef.current = freshRoom.phase_started_at
        if (freshRoom.phase !== gamePhaseRef.current) {
          gamePhaseRef.current = freshRoom.phase
          setGamePhase(freshRoom.phase)
        }
        if (freshRoom.current_song_index !== currentIndexRef.current) {
          currentIndexRef.current = freshRoom.current_song_index
          setCurrentIndex(freshRoom.current_song_index)
          hasSubmittedRef.current = false
          pendingPointsRef.current = 0
          artistAnswerRef.current = ''
          titleAnswerRef.current = ''
          setResult(null)
          setArtistAnswer('')
          setTitleAnswer('')
          setArtistFeedback(null)
          setTitleFeedback(null)
          setFrozen(false)
        }

        const supabase = createClient()
        const { data: freshPlayers } = await supabase.from('room_players').select('*, profiles(pseudo, avatar_id, total_score)').eq('room_id', roomRef.current.id).order('score', { ascending: false })
        setPlayers(freshPlayers || [])

        const currentSong = songsRef.current[currentIndexRef.current]
        if (freshRoom.phase === 'reveal' && currentSong) {
          const { count: ca } = await supabase.from('answers')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', roomRef.current.id)
            .eq('song_id', currentSong.id)
            .eq('artist_correct', true)
          setCorrectArtistCount(ca ?? 0)
          const { count: ct } = await supabase.from('answers')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', roomRef.current.id)
            .eq('song_id', currentSong.id)
            .eq('title_correct', true)
          setCorrectTitleCount(ct ?? 0)
        }

        if (!stopped) pollTimeoutRef.current = setTimeout(doPoll, 500)
      }
      pollFnRef.current = doPoll
      doPoll()
    }

    init()
    return () => { stopped = true; clearTimeout(pollTimeoutRef.current); pollFnRef.current = null }
  }, [code])

  useEffect(() => {
    const interval = setInterval(() => {
      const gp = gamePhaseRef.current
      const duration = gp === 'intro' ? INTRO_DURATION : gp === 'playing' ? PLAY_DURATION : REVEAL_DURATION
      setCountdown(Math.ceil(remainingSeconds(phaseStartedAtRef.current, duration)))
    }, 250)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== 'visible') return
      const gp = gamePhaseRef.current
      const duration = gp === 'intro' ? INTRO_DURATION : gp === 'playing' ? PLAY_DURATION : REVEAL_DURATION
      setCountdown(Math.ceil(remainingSeconds(phaseStartedAtRef.current, duration)))
      clearTimeout(pollTimeoutRef.current)
      if (pollFnRef.current) pollFnRef.current()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  function handleArtistChange(e) {
    const val = e.target.value
    setArtistAnswer(val)
    artistAnswerRef.current = val
    clearTimeout(artistDebounceRef.current)
    artistDebounceRef.current = setTimeout(() => {
      const song = songsRef.current[currentIndexRef.current]
      if (!song || !val) { setArtistFeedback(null); return }
      if (checkAnswer(val, song.artist)) setArtistFeedback('correct')
      else if (closeAnswer(val, song.artist)) setArtistFeedback('close')
      else setArtistFeedback(null)
    }, 300)
  }

  function handleTitleChange(e) {
    const val = e.target.value
    setTitleAnswer(val)
    titleAnswerRef.current = val
    clearTimeout(titleDebounceRef.current)
    titleDebounceRef.current = setTimeout(() => {
      const song = songsRef.current[currentIndexRef.current]
      if (!song || !val) { setTitleFeedback(null); return }
      if (checkAnswer(val, song.title)) setTitleFeedback('correct')
      else if (closeAnswer(val, song.title)) setTitleFeedback('close')
      else setTitleFeedback(null)
    }, 300)
  }

  async function handleSubmit() {
    if (hasSubmittedRef.current) return
    const song = songsRef.current[currentIndexRef.current]
    if (!song) return
    const artistVal = artistAnswerRef.current
    const titleVal = titleAnswerRef.current
    const artistOk = checkAnswer(artistVal, song.artist)
    const titleOk = checkAnswer(titleVal, song.title)
    hasSubmittedRef.current = true

    const supabase = createClient()
    const artistPoints = artistOk ? 5 : 0
    const titlePoints = titleOk ? 5 : 0
    let bonusArtist = 0
    let bonusTitle = 0
    let bonusBoth = 0

    if (artistOk) {
      const { count } = await supabase.from('answers')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomRef.current.id)
        .eq('song_id', song.id)
        .eq('artist_correct', true)
      if (count === 0) bonusArtist = 1
    }
    if (titleOk) {
      const { count } = await supabase.from('answers')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomRef.current.id)
        .eq('song_id', song.id)
        .eq('title_correct', true)
      if (count === 0) bonusTitle = 1
    }
    if (artistOk && titleOk) {
      const { count } = await supabase.from('answers')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomRef.current.id)
        .eq('song_id', song.id)
        .eq('artist_correct', true)
        .eq('title_correct', true)
      if (count === 0) bonusBoth = 1
    }

    const points = artistPoints + titlePoints + bonusArtist + bonusTitle + bonusBoth
    const songIndex = currentIndexRef.current

    setResult({ artistOk, titleOk, points, song, bonusArtist, bonusTitle, bonusBoth })
    setPastResults(prev => [...prev, { songIndex, points }])

    await supabase.from('answers').insert({
      room_id: roomRef.current.id,
      player_id: userRef.current.id,
      song_id: song.id,
      artist_answer: artistVal || '',
      title_answer: titleVal || '',
      artist_correct: artistOk,
      title_correct: titleOk,
      points,
      answered_at: new Date().toISOString()
    })
    if (points > 0) {
      const newScore = myScoreRef.current + points
      myScoreRef.current = newScore
      setMyScore(newScore)
      // On ne pousse pas le score en base tout de suite : il sera envoyé au reveal
      // pour que le classement ne se mette à jour qu'à ce moment-là.
      pendingPointsRef.current = points
    }
  }

  function handleFiger() {
    setFrozen(true)
    handleSubmit()
  }

  useEffect(() => {
    if (gamePhase !== 'reveal') return
    ;(async () => {
      // On attend que handleSubmit ait calculé/enregistré les points (sauf si déjà soumis)
      await handleSubmit()
      if (pendingPointsRef.current > 0) {
        const supabase = createClient()
        await supabase.from('room_players').update({ score: myScoreRef.current }).eq('room_id', roomRef.current.id).eq('player_id', userRef.current.id)
        pendingPointsRef.current = 0
      }
    })()
  }, [gamePhase])

  if (!room || songsRef.current.length === 0) return (
    <main style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui'}}>
      <p style={{color:'#999', fontSize:'14px'}}>Chargement...</p>
    </main>
  )

  const totalSongs = songsRef.current.length
  const maxDuration = gamePhase === 'intro' ? INTRO_DURATION : gamePhase === 'playing' ? PLAY_DURATION : REVEAL_DURATION
  const currentSong = songsRef.current[currentIndex]

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#fff', fontFamily:'system-ui, sans-serif', display:'flex', flexDirection:'column'}}>

      {gamePhase === 'playing' && currentSong?.youtube_id && (
        <div style={{position:'fixed', top:'-9999px', left:'-9999px', width:'1px', height:'1px', overflow:'hidden'}}>
          <iframe
            key={currentIndex}
            width="1" height="1"
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
          <span style={{fontSize:'13px', color:'#999'}}>Morceau {currentIndex + 1} / {totalSongs}</span>
          <span style={{fontSize:'13px', fontWeight:'500', color:'#111'}}>Score : {myScore} pts</span>
        </div>
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
              <ul style={{listStyle:'none', margin:'32px 0 0', padding:'16px 24px', backgroundColor:'#f8f8f8', borderRadius:'12px', fontSize:'13px', color:'#666', display:'flex', flexDirection:'column', gap:'8px', maxWidth:'400px', width:'100%', boxSizing:'border-box'}}>
                <li>🎵 Trouve l'artiste et le titre de chaque morceau</li>
                <li>✏️ Tu peux modifier ta réponse jusqu'à la fin du timer</li>
                <li>🥇 Bonus pour le premier à trouver !</li>
                <li>🎯 5 pts par bonne réponse + bonus premiers</li>
              </ul>
            </>
          )}

          {gamePhase === 'playing' && (
            <>
              <p style={{fontSize:'12px', color:'#999', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'24px'}}>Morceau {currentIndex + 1} / {totalSongs}</p>
              <div style={{width:'120px', height:'120px', backgroundColor:'#f0f0f0', borderRadius:'16px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'48px', marginBottom:'24px'}}>🎵</div>
              <div style={{fontSize:'56px', fontWeight:'500', color: countdown <= 5 ? '#ef4444' : '#111', marginBottom:'32px'}}>
                {countdown}<span style={{fontSize:'18px', color:'#999', fontWeight:'400', marginLeft:'4px'}}>s</span>
              </div>
              <div style={{width:'100%', maxWidth:'400px', display:'flex', flexDirection:'column', gap:'12px'}}>
                <div>
                  <input
                    value={artistAnswer}
                    onChange={handleArtistChange}
                    placeholder="Artiste..."
                    disabled={frozen}
                    style={{width:'100%', padding:'14px 16px', border:`1px solid ${artistFeedback === 'correct' ? '#16a34a' : artistFeedback === 'close' ? '#f59e0b' : '#e0e0e0'}`, borderRadius:'8px', fontSize:'16px', outline:'none', color:'#111', boxSizing:'border-box', backgroundColor:'#fff'}}
                    onKeyDown={e => e.key === 'Enter' && !frozen && handleFiger()}
                    autoFocus
                  />
                  {artistFeedback === 'correct' && <p style={{fontSize:'12px', color:'#16a34a', fontWeight:'500', marginTop:'4px', marginLeft:'2px'}}>✓ Artiste trouvé !</p>}
                  {artistFeedback === 'close' && <p style={{fontSize:'12px', color:'#ea580c', fontWeight:'500', marginTop:'4px', marginLeft:'2px'}}>Pas loin !</p>}
                </div>
                <div>
                  <input
                    value={titleAnswer}
                    onChange={handleTitleChange}
                    placeholder="Titre..."
                    disabled={frozen}
                    style={{width:'100%', padding:'14px 16px', border:`1px solid ${titleFeedback === 'correct' ? '#16a34a' : titleFeedback === 'close' ? '#f59e0b' : '#e0e0e0'}`, borderRadius:'8px', fontSize:'16px', outline:'none', color:'#111', boxSizing:'border-box', backgroundColor:'#fff'}}
                    onKeyDown={e => e.key === 'Enter' && !frozen && handleFiger()}
                  />
                  {titleFeedback === 'correct' && <p style={{fontSize:'12px', color:'#16a34a', fontWeight:'500', marginTop:'4px', marginLeft:'2px'}}>✓ Titre trouvé !</p>}
                  {titleFeedback === 'close' && <p style={{fontSize:'12px', color:'#ea580c', fontWeight:'500', marginTop:'4px', marginLeft:'2px'}}>Pas loin !</p>}
                </div>
              </div>
            </>
          )}

          {gamePhase === 'reveal' && (
            <>
              <p style={{fontSize:'12px', color:'#999', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'24px'}}>Révélation</p>
              <div style={{textAlign:'center', marginBottom:'24px', display:'flex', flexDirection:'column', alignItems:'center'}}>
                {currentSong?.cover_url
                  ? <img src={currentSong.cover_url} width={100} height={100} style={{borderRadius:'12px', marginBottom:'16px'}} referrerPolicy="no-referrer" alt="" />
                  : <div style={{width:'100px', height:'100px', backgroundColor:'#f0f0f0', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'36px', margin:'0 auto 16px'}}>🎤</div>
                }
                <p style={{fontSize:'22px', fontWeight:'500', color:'#111', marginBottom:'4px'}}>{currentSong?.title}</p>
                <p style={{fontSize:'15px', color:'#666'}}>{currentSong?.artist}</p>
              </div>

              {/* Tableau récapitulatif */}
              {(() => {
                const artistOk = result?.artistOk ?? false
                const titleOk = result?.titleOk ?? false
                const bonusArtist = result?.bonusArtist ?? 0
                const bonusTitle = result?.bonusTitle ?? 0
                const bonusBoth = result?.bonusBoth ?? 0
                const total = result?.points ?? 0
                const n = players.length

                const Row = ({ label, value, ok }) => (
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid #f0f0f0'}}>
                    <span style={{fontSize:'13px', color:'#666'}}>{label}</span>
                    <span style={{fontSize:'13px', fontWeight:'500', color: ok ? '#16a34a' : '#bbb'}}>{value}</span>
                  </div>
                )

                return (
                  <div style={{width:'100%', maxWidth:'320px', margin:'0 auto 24px'}}>
                    {!result && <p style={{fontSize:'13px', color:'#999', textAlign:'center', marginBottom:'12px', fontStyle:'italic'}}>Tu n'as pas répondu</p>}
                    <Row label={`Artiste correct (${correctArtistCount}/${n})`} value={artistOk ? '+5 pts' : '0'} ok={artistOk} />
                    <Row label={`Titre correct (${correctTitleCount}/${n})`} value={titleOk ? '+5 pts' : '0'} ok={titleOk} />
                    <Row label={`1er à trouver l'artiste`} value={bonusArtist > 0 ? '+1 pt' : '—'} ok={bonusArtist > 0} />
                    <Row label={`1er à trouver le titre`} value={bonusTitle > 0 ? '+1 pt' : '—'} ok={bonusTitle > 0} />
                    <Row label={`1er à trouver les deux`} value={bonusBoth > 0 ? '+1 pt' : '—'} ok={bonusBoth > 0} />
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:'10px', marginTop:'4px'}}>
                      <span style={{fontSize:'13px', fontWeight:'500', color:'#111'}}>Total</span>
                      <span style={{fontSize:'18px', fontWeight:'500', color: total > 0 ? '#16a34a' : '#bbb'}}>{total > 0 ? `+${total} pts` : '0 pt'}</span>
                    </div>
                  </div>
                )
              })()}
              <div style={{fontSize:'36px', fontWeight:'500', color: countdown <= 2 ? '#ef4444' : '#999'}}>
                {countdown}<span style={{fontSize:'14px', fontWeight:'400', marginLeft:'4px'}}>s</span>
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
                <p style={{fontSize:'12px', fontWeight:'500', color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{getLevel(p.profiles?.total_score || 0).emoji} {p.profiles?.pseudo}</p>
                <p style={{fontSize:'11px', color:'#999'}}>{p.score} pts</p>
              </div>
            </div>
          ))}

          {currentIndex > 0 && (
            <>
              <div style={{borderTop:'1px solid #f0f0f0', marginTop:'16px', marginBottom:'16px'}} />
              <p style={{fontSize:'12px', fontWeight:'500', color:'#999', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'12px'}}>Morceaux joués</p>
              {songsRef.current.slice(0, currentIndex).map((s, i) => {
                const pr = pastResults.find(r => r.songIndex === i)
                return (
                  <div key={s.id} style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px'}}>
                    {s.cover_url
                      ? <img src={s.cover_url} width={32} height={32} style={{borderRadius:'4px', flexShrink:0}} referrerPolicy="no-referrer" alt="" />
                      : <div style={{width:'32px', height:'32px', backgroundColor:'#f0f0f0', borderRadius:'4px', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px'}}>🎵</div>
                    }
                    <div style={{flex:1, minWidth:0}}>
                      <p style={{fontSize:'11px', fontWeight:'500', color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.title}</p>
                      <p style={{fontSize:'11px', color:'#999', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.artist}</p>
                    </div>
                    <span style={{fontSize:'11px', fontWeight:'500', color: pr ? '#16a34a' : '#ccc', flexShrink:0}}>
                      {pr ? `+${pr.points}` : '—'}
                    </span>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    </main>
  )
}
