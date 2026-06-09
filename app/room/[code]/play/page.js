'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '../../../../lib/supabase'
import Link from 'next/link'
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
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [audioError, setAudioError] = useState('')
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
  const ytPlayerRef = useRef(null)
  const ytReadyRef = useRef(false)
  const ytContainerRef = useRef(null)
  const channelRef = useRef(null)
  const realtimeRef = useRef(null)
  const playersIntervalRef = useRef(null)
  const visibilityHandlerRef = useRef(null)

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

      if (stopped) return

      // Rafraîchit le classement (peu critique → polling léger 3s)
      async function refreshPlayers() {
        if (!roomRef.current) return
        const sb = createClient()
        const { data } = await sb.from('room_players').select('*, profiles(pseudo, avatar_id, total_score)').eq('room_id', roomRef.current.id).order('score', { ascending: false })
        if (!stopped) setPlayers(data || [])
      }

      // Rafraîchit les compteurs "X/N ont trouvé" affichés au reveal
      async function refreshRevealCounts() {
        if (!roomRef.current) return
        const song = songsRef.current[currentIndexRef.current]
        if (!song) return
        const sb = createClient()
        const { count: ca } = await sb.from('answers').select('*', { count: 'exact', head: true }).eq('room_id', roomRef.current.id).eq('song_id', song.id).eq('artist_correct', true)
        const { count: ct } = await sb.from('answers').select('*', { count: 'exact', head: true }).eq('room_id', roomRef.current.id).eq('song_id', song.id).eq('title_correct', true)
        if (!stopped) { setCorrectArtistCount(ca ?? 0); setCorrectTitleCount(ct ?? 0) }
      }

      // Applique un état room frais (depuis le Realtime ou une resync) : phases, morceau, fin de partie
      function applyRoomState(freshRoom) {
        if (!freshRoom || stopped) return
        if (freshRoom.status === 'finished') { stopped = true; router.push(`/room/${code}/results`); return }
        if (freshRoom.status === 'interrupted') { stopped = true; router.push(`/room/${code}/interrupted`); return }

        phaseStartedAtRef.current = freshRoom.phase_started_at
        if (freshRoom.phase !== gamePhaseRef.current) {
          gamePhaseRef.current = freshRoom.phase
          setGamePhase(freshRoom.phase)
          if (freshRoom.phase === 'reveal') refreshRevealCounts()
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
      }

      // Si on arrive directement en plein reveal, on charge les compteurs tout de suite
      if (gamePhaseRef.current === 'reveal') refreshRevealCounts()

      // Phases pilotées en push via Supabase Realtime (plus de polling /api/room-state)
      const supabaseRealtime = createClient()
      const channel = supabaseRealtime
        .channel(`room-${roomData.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomData.id}`
        }, (payload) => applyRoomState(payload.new))
        .subscribe()
      realtimeRef.current = supabaseRealtime
      channelRef.current = channel

      // Classement : polling léger toutes les 3s (room_players + compteurs si on est au reveal)
      playersIntervalRef.current = setInterval(() => {
        refreshPlayers()
        if (gamePhaseRef.current === 'reveal') refreshRevealCounts()
      }, 3000)

      // Resync one-shot au retour de visibilité : le websocket a pu manquer un event en arrière-plan
      async function handleVisibility() {
        if (document.visibilityState !== 'visible' || stopped || !roomRef.current) return
        const gp = gamePhaseRef.current
        const duration = gp === 'intro' ? INTRO_DURATION : gp === 'playing' ? PLAY_DURATION : REVEAL_DURATION
        setCountdown(Math.ceil(remainingSeconds(phaseStartedAtRef.current, duration)))
        try {
          const res = await fetch(`/api/room-state?code=${roomRef.current.code}`, { cache: 'no-store' })
          applyRoomState(await res.json())
          refreshPlayers()
        } catch {}
      }
      visibilityHandlerRef.current = handleVisibility
      document.addEventListener('visibilitychange', handleVisibility)
    }

    init()
    return () => {
      stopped = true
      clearInterval(playersIntervalRef.current)
      if (realtimeRef.current && channelRef.current) realtimeRef.current.removeChannel(channelRef.current)
      if (visibilityHandlerRef.current) document.removeEventListener('visibilitychange', visibilityHandlerRef.current)
    }
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
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    setIsIOS(ios)
  }, [])

  // iOS : charge l'API YouTube IFrame et crée un player caché hors écran.
  // Robuste : on ne dépend pas du seul callback onYouTubeIframeAPIReady (fragile),
  // on poll jusqu'à ce que l'API soit dispo puis on crée le player.
  useEffect(() => {
    if (!isIOS) return
    let cancelled = false

    function tryCreate() {
      if (cancelled || ytPlayerRef.current) return
      if (!ytContainerRef.current) return
      if (!(window.YT && window.YT.Player)) return
      // Noeud DOM enfant que React ne réconcilie jamais (conteneur sans enfants JSX),
      // pour éviter que React n'écrase l'iframe créée par l'API YouTube.
      const mount = document.createElement('div')
      ytContainerRef.current.appendChild(mount)
      setAudioError('creating')
      ytPlayerRef.current = new window.YT.Player(mount, {
        height: '1',
        width: '1',
        playerVars: { playsinline: 1, controls: 0, disablekb: 1 },
        events: {
          onReady: () => { ytReadyRef.current = true; setAudioError('ready') },
          onError: (e) => setAudioError('yt: ' + e.data),
        },
      })
    }

    // Injecte le script de l'API si absent
    if (!window.YT && !document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      setAudioError('loading API')
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(tag)
    }
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { if (prev) { try { prev() } catch {} } tryCreate() }

    tryCreate()
    const poll = setInterval(() => {
      if (ytPlayerRef.current) { clearInterval(poll); return }
      tryCreate()
    }, 400)

    return () => {
      cancelled = true
      clearInterval(poll)
      if (ytPlayerRef.current && ytPlayerRef.current.destroy) {
        try { ytPlayerRef.current.destroy() } catch {}
        ytPlayerRef.current = null
        ytReadyRef.current = false
      }
    }
  }, [isIOS])

  // iOS : pilote la lecture YouTube selon la phase (le player a été activé par le geste).
  useEffect(() => {
    if (!isIOS || !ytPlayerRef.current || !ytReadyRef.current) return
    const song = songsRef.current[currentIndexRef.current]
    if (gamePhase === 'playing' && song?.youtube_id) {
      try { ytPlayerRef.current.loadVideoById(song.youtube_id) } catch (e) { setAudioError('play: ' + e.message) }
    } else {
      try { ytPlayerRef.current.stopVideo ? ytPlayerRef.current.stopVideo() : ytPlayerRef.current.pauseVideo() } catch {}
    }
  }, [gamePhase, isIOS, currentIndex, audioUnlocked])

  // Déverrouille la lecture YouTube iOS dans le geste utilisateur (tap "Activer le son").
  function unlockAudioIOS() {
    try {
      if (!ytPlayerRef.current) { setAudioError('no player'); return }
      if (!ytReadyRef.current) { setAudioError('player pas encore prêt, retape'); return }
      const song = songsRef.current[currentIndexRef.current]
      if (gamePhaseRef.current === 'playing' && song?.youtube_id) {
        ytPlayerRef.current.loadVideoById(song.youtube_id)
      } else {
        ytPlayerRef.current.playVideo()
        ytPlayerRef.current.pauseVideo()
      }
      setAudioUnlocked(true)
      setAudioError('unlocked')
    } catch (e) {
      setAudioError('unlock: ' + e.message)
    }
  }

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
  const phaseKey = `${gamePhase}-${currentIndex}`

  const audioUnlockPrompt = isIOS && !audioUnlocked ? (
    <button
      onClick={unlockAudioIOS}
      style={{marginTop:'24px', padding:'14px 28px', backgroundColor:'#3b82f6', color:'#fff', border:'none', borderRadius:'8px', fontSize:'16px', fontWeight:'500', cursor:'pointer', boxSizing:'border-box', maxWidth:'400px', width:'100%'}}
    >
      🔊 Activer le son
    </button>
  ) : null

  const audioErrorMsg = isIOS && audioError ? (
    <p style={{fontSize:'12px', color:'#ef4444', marginTop:'8px', textAlign:'center'}}>⚠️ {audioError}</p>
  ) : null

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#fff', fontFamily:'system-ui, sans-serif', display:'flex', flexDirection:'column'}}>

      <style>{`
        .player-link { color: inherit; text-decoration: none; cursor: pointer; }
        .player-link:hover { text-decoration: underline; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @media (max-width: 768px) {
          .play-nav { padding: 12px 16px !important; }
          .play-nav-text { font-size: 11px !important; }
          .play-content { padding: 24px 16px !important; }
          .play-intro-title { font-size: 28px !important; }
          .play-intro-count { font-size: 48px !important; }
          .play-rules { padding: 12px 16px !important; }
          .play-mystery { width: 80px !important; height: 80px !important; font-size: 36px !important; }
          .play-count { font-size: 48px !important; }
          .play-cover { width: 80px !important; height: 80px !important; }
          .play-reveal-title { font-size: 18px !important; }
          .play-table { max-width: 100% !important; }
          .play-sidebar { display: none !important; }
          .play-fab { display: flex !important; }
        }
      `}</style>

      {!isIOS && gamePhase === 'playing' && currentSong?.youtube_id && (
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

      {isIOS && (
        <div ref={ytContainerRef} style={{position:'fixed', top:'-9999px', left:'-9999px', width:'1px', height:'1px', overflow:'hidden'}} />
      )}

      <div className="play-nav" style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 32px', borderBottom:'1px solid #f0f0f0'}}>
        <div style={{display:'flex', alignItems:'baseline', gap:'2px'}}>
          <span style={{fontSize:'18px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>obladi</span>
          <span style={{fontSize:'18px', fontWeight:'500', color:'#3b82f6'}}>.</span>
        </div>
        <a href="/dashboard" className="play-nav-text" style={{fontSize:'13px', color:'#999', textDecoration:'none', marginRight:'auto', marginLeft:'16px'}}>← Quitter</a>
        <div style={{display:'flex', alignItems:'center', gap:'16px'}}>
          <span className="play-nav-text" style={{fontSize:'13px', color:'#999'}}>Morceau {currentIndex + 1} / {totalSongs}</span>
          <span className="play-nav-text" style={{fontSize:'13px', fontWeight:'500', color:'#111'}}>Score : {myScore} pts</span>
        </div>
      </div>

      <div style={{height:'3px', backgroundColor:'#f0f0f0'}}>
        <div style={{height:'3px', backgroundColor:'#3b82f6', width:`${Math.round((countdown / maxDuration) * 100)}%`, transition:'width 0.25s linear'}} />
      </div>

      <div style={{flex:1, display:'flex', overflow:'hidden'}}>
        <div key={phaseKey} className="play-content" style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'48px', animation:'fadeInUp 0.4s ease forwards'}}>

          {gamePhase === 'intro' && (
            <>
              <div style={{fontSize:'72px', marginBottom:'24px'}}>🎵</div>
              <h1 className="play-intro-title" style={{fontSize:'40px', fontWeight:'500', letterSpacing:'-1px', color:'#111', textAlign:'center', marginBottom:'16px', lineHeight:'1.1'}}>
                Vous êtes prêts ?<br />Ça va commencer !
              </h1>
              <div className="play-intro-count" style={{fontSize:'64px', fontWeight:'500', color: countdown <= 5 ? '#ef4444' : '#111', marginTop:'32px', animation: countdown <= 5 ? 'pulse 0.5s ease infinite' : 'none'}}>
                {countdown}<span style={{fontSize:'20px', color:'#999', fontWeight:'400', marginLeft:'4px'}}>s</span>
              </div>
              <ul className="play-rules" style={{listStyle:'none', margin:'32px 0 0', padding:'16px 24px', backgroundColor:'#f8f8f8', borderRadius:'12px', fontSize:'13px', color:'#666', display:'flex', flexDirection:'column', gap:'8px', maxWidth:'400px', width:'100%', boxSizing:'border-box'}}>
                <li>🎵 Trouve l'artiste et le titre de chaque morceau</li>
                <li>✏️ Tu peux modifier ta réponse jusqu'à la fin du timer</li>
                <li>🥇 Bonus pour le premier à trouver !</li>
                <li>🎯 5 pts par bonne réponse + bonus premiers</li>
              </ul>
              {audioUnlockPrompt}
              {audioErrorMsg}
            </>
          )}

          {gamePhase === 'playing' && (
            <>
              <p style={{fontSize:'12px', color:'#999', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'24px'}}>Morceau {currentIndex + 1} / {totalSongs}</p>
              <div className="play-mystery" style={{width:'120px', height:'120px', backgroundColor:'#f0f0f0', borderRadius:'16px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'48px', marginBottom:'24px'}}>🎵</div>
              <div className="play-count" style={{fontSize:'56px', fontWeight:'500', color: countdown <= 5 ? '#ef4444' : '#111', marginBottom:'32px', animation: countdown <= 5 ? 'pulse 0.5s ease infinite' : 'none'}}>
                {countdown}<span style={{fontSize:'18px', color:'#999', fontWeight:'400', marginLeft:'4px'}}>s</span>
              </div>
              {isIOS && !currentSong?.preview_url && (
                <p style={{fontSize:'13px', color:'#999', marginTop:'-16px', marginBottom:'24px'}}>🔇 Pas d'audio disponible</p>
              )}
              {audioUnlockPrompt && <div style={{marginBottom:'24px'}}>{audioUnlockPrompt}</div>}
              {audioErrorMsg && <div style={{marginBottom:'16px'}}>{audioErrorMsg}</div>}
              <div style={{width:'100%', maxWidth:'400px', display:'flex', flexDirection:'column', gap:'12px'}}>
                <div>
                  <input
                    value={artistAnswer}
                    onChange={handleArtistChange}
                    placeholder="Artiste..."
                    disabled={frozen}
                    tabIndex={1}
                    style={{width:'100%', padding:'14px 16px', border:`1px solid ${artistFeedback === 'correct' ? '#16a34a' : artistFeedback === 'close' ? '#f59e0b' : '#e0e0e0'}`, borderRadius:'8px', fontSize:'16px', outline:'none', color:'#111', boxSizing:'border-box', backgroundColor:'#fff'}}
                    onKeyDown={e => e.key === 'Enter' && !frozen && handleFiger()}
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
                    tabIndex={2}
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
                  ? <img src={currentSong.cover_url} width={100} height={100} className="play-cover" style={{borderRadius:'12px', marginBottom:'16px', animation:'fadeInUp 0.5s ease forwards'}} referrerPolicy="no-referrer" alt="" />
                  : <div className="play-cover" style={{width:'100px', height:'100px', backgroundColor:'#f0f0f0', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'36px', margin:'0 auto 16px'}}>🎤</div>
                }
                <p className="play-reveal-title" style={{fontSize:'22px', fontWeight:'500', color:'#111', marginBottom:'4px'}}>{currentSong?.title}</p>
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
                  <div className="play-table" style={{width:'100%', maxWidth:'320px', margin:'0 auto 24px'}}>
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

        <div className="play-sidebar" style={{width:'220px', borderLeft:'1px solid #f0f0f0', padding:'24px 16px', overflowY:'auto'}}>
          <p style={{fontSize:'12px', fontWeight:'500', color:'#999', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'16px'}}>Classement</p>
          {players.map((p, i) => (
            <div key={p.id} style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px'}}>
              <span style={{fontSize:'12px', color:'#999', width:'16px'}}>{i+1}</span>
              <span style={{fontSize:'16px'}}>{AVATARS[p.profiles?.avatar_id] || '🎵'}</span>
              <div style={{flex:1, minWidth:0}}>
                <p style={{fontSize:'12px', fontWeight:'500', color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{getLevel(p.profiles?.total_score || 0).emoji} <Link href={`/player/${p.player_id}`} className="player-link">{p.profiles?.pseudo}</Link></p>
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

      {/* Bouton flottant classement (mobile uniquement) */}
      <button
        className="play-fab"
        onClick={() => setShowLeaderboard(true)}
        style={{display:'none', position:'fixed', bottom:'20px', right:'20px', zIndex:50, alignItems:'center', gap:'6px', padding:'12px 18px', backgroundColor:'#111', color:'#fff', border:'none', borderRadius:'99px', fontSize:'14px', fontWeight:'500', cursor:'pointer', boxShadow:'0 4px 16px rgba(0,0,0,0.2)'}}
      >
        🏆 Classement
      </button>

      {/* Drawer classement (mobile) */}
      {showLeaderboard && (
        <div onClick={() => setShowLeaderboard(false)} style={{position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.4)', zIndex:60}}>
          <div onClick={e => e.stopPropagation()} style={{position:'fixed', bottom:0, left:0, right:0, height:'60%', backgroundColor:'#fff', borderRadius:'16px 16px 0 0', padding:'24px', boxSizing:'border-box', overflowY:'auto', zIndex:61, animation:'slideUp 0.25s ease forwards'}}>
            <div onClick={() => setShowLeaderboard(false)} style={{width:'40px', height:'4px', backgroundColor:'#e0e0e0', borderRadius:'2px', margin:'0 auto 20px', cursor:'pointer'}} />
            <p style={{fontSize:'12px', fontWeight:'500', color:'#999', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'16px'}}>Classement</p>
            {players.map((p, i) => (
              <div key={p.id} style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px'}}>
                <span style={{fontSize:'13px', color:'#999', width:'18px'}}>{i+1}</span>
                <span style={{fontSize:'22px'}}>{AVATARS[p.profiles?.avatar_id] || '🎵'}</span>
                <div style={{flex:1, minWidth:0}}>
                  <p style={{fontSize:'14px', fontWeight:'500', color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{getLevel(p.profiles?.total_score || 0).emoji} <Link href={`/player/${p.player_id}`} className="player-link">{p.profiles?.pseudo}</Link></p>
                  <p style={{fontSize:'12px', color:'#999'}}>{p.score} pts</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
