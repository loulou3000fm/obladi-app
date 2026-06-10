'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../../lib/supabase'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

const AVATARS = { avatar_1:'🎵', avatar_2:'🎸', avatar_3:'🎹', avatar_4:'🥁', avatar_5:'🎺', avatar_6:'🎻', avatar_7:'🎤', avatar_8:'🎧' }
const MEDALS = ['🥇', '🥈', '🥉']

export default function Recap() {
  const { code } = useParams()
  const router = useRouter()
  const [room, setRoom] = useState(null)
  const [songs, setSongs] = useState([])
  const [answers, setAnswers] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: roomData } = await supabase
        .from('rooms')
        .select('*, playlists(id, name)')
        .eq('code', code.toUpperCase())
        .maybeSingle()

      if (!roomData) { setError("Cette partie n'est plus disponible"); setLoading(false); return }
      setRoom(roomData)

      if (roomData.playlists?.id) {
        const { data: songsData } = await supabase
          .from('songs')
          .select('*')
          .eq('playlist_id', roomData.playlists.id)
          .order('position', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true })
        setSongs(songsData || [])
      }

      const { data: answersData } = await supabase
        .from('answers')
        .select('song_id, artist_answer, title_answer, artist_correct, title_correct, points')
        .eq('room_id', roomData.id)
        .eq('player_id', user.id)
      setAnswers(answersData || [])

      const { data: playersData } = await supabase
        .from('room_players')
        .select('*, profiles(pseudo, avatar_id)')
        .eq('room_id', roomData.id)
        .order('score', { ascending: false })
      setPlayers(playersData || [])

      setLoading(false)
    }
    init()
  }, [code])

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return (
    <main style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui'}}>
      <p style={{color:'#999', fontSize:'14px'}}>Chargement...</p>
    </main>
  )

  if (error) return (
    <main style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui'}}>
      <div style={{textAlign:'center'}}>
        <p style={{fontSize:'48px', marginBottom:'16px'}}>🎵</p>
        <p style={{fontSize:'18px', fontWeight:'500', color:'#111', marginBottom:'8px'}}>{error}</p>
        <a href="/dashboard" style={{fontSize:'14px', color:'#666', textDecoration:'underline'}}>Retour à mon espace</a>
      </div>
    </main>
  )

  const answerBySong = {}
  for (const a of answers) answerBySong[a.song_id] = a

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#fff', fontFamily:'system-ui, sans-serif'}}>
      <style>{`
        .player-link { color: inherit; text-decoration: none; cursor: pointer; }
        .player-link:hover { text-decoration: underline; }
        @media (max-width: 768px) {
          .recap-nav { padding: 16px 24px !important; }
          .recap-container { padding: 24px 16px !important; }
          .recap-row { padding: 12px 14px !important; }
        }
      `}</style>

      <nav className="recap-nav" style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'24px 48px', borderBottom:'1px solid #f0f0f0'}}>
        <button onClick={() => router.back()} style={{background:'none', border:'none', cursor:'pointer', fontSize:'14px', color:'#666'}}>← Retour</button>
        <div style={{display:'flex', alignItems:'baseline', gap:'2px'}}>
          <span style={{fontSize:'18px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>obladi</span>
          <span style={{fontSize:'18px', fontWeight:'500', color:'#3b82f6'}}>.</span>
        </div>
      </nav>

      <div className="recap-container" style={{maxWidth:'600px', margin:'0 auto', padding:'48px'}}>

        {/* En-tête */}
        <div style={{textAlign:'center', marginBottom:'40px'}}>
          <h1 style={{fontSize:'28px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111', marginBottom:'8px'}}>{room.title || room.playlists?.name}</h1>
          <p style={{fontSize:'14px', color:'#999'}}>{formatDate(room.created_at)} · {players.length} joueur{players.length > 1 ? 's' : ''}</p>
        </div>

        {/* Podium top 3 */}
        {players.length >= 2 && (
          <div style={{display:'flex', alignItems:'flex-end', justifyContent:'center', gap:'8px', marginBottom:'32px'}}>
            {[players[1], players[0], players[2]].filter(Boolean).map((p, i) => {
              const rank = i === 1 ? 0 : i === 0 ? 1 : 2
              const heights = [80, 110, 60]
              return (
                <div key={p.id} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'8px'}}>
                  <span style={{fontSize:'24px'}}>{AVATARS[p.profiles?.avatar_id] || '🎵'}</span>
                  <span style={{fontSize:'13px', fontWeight:'500', color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'100%'}}><Link href={`/player/${p.player_id}`} className="player-link">{p.profiles?.pseudo}</Link></span>
                  <span style={{fontSize:'12px', color:'#999'}}>{p.score} pts</span>
                  <div style={{width:'100%', height:`${heights[i]}px`, backgroundColor: rank === 0 ? '#fef9c3' : rank === 1 ? '#f0f0f0' : '#fef3e2', borderRadius:'8px 8px 0 0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px'}}>
                    {MEDALS[rank]}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Classement complet */}
        <div style={{border:'1px solid #f0f0f0', borderRadius:'12px', overflow:'hidden', marginBottom:'40px'}}>
          {players.map((p, i) => (
            <div key={p.id} className="recap-row" style={{display:'flex', alignItems:'center', gap:'12px', padding:'14px 20px', borderBottom: i < players.length - 1 ? '1px solid #f8f8f8' : 'none', backgroundColor: i === 0 ? '#fffbeb' : 'white'}}>
              <span style={{fontSize:'16px', width:'24px', textAlign:'center'}}>{MEDALS[i] || i + 1}</span>
              <span style={{fontSize:'22px'}}>{AVATARS[p.profiles?.avatar_id] || '🎵'}</span>
              <p style={{flex:1, fontSize:'14px', fontWeight:'500', color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}><Link href={`/player/${p.player_id}`} className="player-link">{p.profiles?.pseudo}</Link></p>
              <p style={{fontSize:'15px', fontWeight:'500', color:'#111'}}>{p.score} pts</p>
            </div>
          ))}
        </div>

        {/* Morceaux joués */}
        <h2 style={{fontSize:'18px', fontWeight:'500', color:'#111', marginBottom:'16px', letterSpacing:'-0.3px'}}>Morceaux joués</h2>
        <div style={{border:'1px solid #f0f0f0', borderRadius:'12px', overflow:'hidden'}}>
          {songs.map((s, i) => {
            const ans = answerBySong[s.id]
            return (
              <div key={s.id} className="recap-row" style={{display:'flex', alignItems:'center', gap:'12px', padding:'14px 20px', borderBottom: i < songs.length - 1 ? '1px solid #f8f8f8' : 'none'}}>
                {s.cover_url
                  ? <img src={s.cover_url} width={44} height={44} style={{borderRadius:'6px', flexShrink:0}} referrerPolicy="no-referrer" alt="" />
                  : <div style={{width:'44px', height:'44px', backgroundColor:'#f0f0f0', borderRadius:'6px', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px'}}>🎵</div>
                }
                <div style={{flex:1, minWidth:0}}>
                  <p style={{fontSize:'14px', fontWeight:'500', color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.title}</p>
                  <p style={{fontSize:'12px', color:'#999', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.artist}</p>
                </div>
                {ans ? (
                  <div style={{textAlign:'right', flexShrink:0}}>
                    <div style={{display:'flex', gap:'8px', justifyContent:'flex-end', marginBottom:'2px'}}>
                      <span style={{fontSize:'11px', color: ans.artist_correct ? '#16a34a' : '#bbb'}}>{ans.artist_correct ? '✓' : '✗'} Artiste</span>
                      <span style={{fontSize:'11px', color: ans.title_correct ? '#16a34a' : '#bbb'}}>{ans.title_correct ? '✓' : '✗'} Titre</span>
                    </div>
                    <span style={{fontSize:'14px', fontWeight:'500', color: ans.points > 0 ? '#16a34a' : '#bbb'}}>{ans.points > 0 ? `+${ans.points} pts` : '0 pt'}</span>
                  </div>
                ) : (
                  <span style={{fontSize:'14px', color:'#ccc', flexShrink:0}}>—</span>
                )}
              </div>
            )
          })}
        </div>

      </div>
    </main>
  )
}
