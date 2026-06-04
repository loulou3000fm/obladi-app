'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../../lib/supabase'
import { useParams, useRouter } from 'next/navigation'

const AVATARS = { avatar_1:'🎵', avatar_2:'🎸', avatar_3:'🎹', avatar_4:'🥁', avatar_5:'🎺', avatar_6:'🎻', avatar_7:'🎤', avatar_8:'🎧' }

const MEDALS = ['🥇', '🥈', '🥉']

export default function Results() {
  const { code } = useParams()
  const router = useRouter()
  const [players, setPlayers] = useState([])
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: roomData } = await supabase.from('rooms').select('*, playlists(name)').eq('code', code.toUpperCase()).single()
      setRoom(roomData)
      const { data } = await supabase.from('room_players').select('*, profiles(pseudo, avatar_id)').eq('room_id', roomData.id).order('score', { ascending: false })
      setPlayers(data || [])
      setLoading(false)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const player = data?.find(p => p.player_id === user.id)
        if (player) {
          const totalQuestions = data?.length || 0
          const answeredQuestions = await supabase
            .from('answers')
            .select('id', { count: 'exact' })
            .eq('room_id', roomData.id)
            .eq('player_id', user.id)

          const questionsAnswered = answeredQuestions.count || 0
          const completed = questionsAnswered >= totalQuestions

          await supabase.from('game_sessions').insert({
            player_id: user.id,
            score: player.score,
            theme: roomData.playlists?.name || 'Général',
            total_questions: totalQuestions,
            questions_answered: questionsAnswered,
            completed: completed
          })

          if (completed) {
            const { data: prof } = await supabase.from('profiles').select('games_played, total_score, best_score').eq('id', user.id).single()
            await supabase.from('profiles').update({
              games_played: (prof?.games_played || 0) + 1,
              total_score: (prof?.total_score || 0) + player.score,
              best_score: Math.max(prof?.best_score || 0, player.score)
            }).eq('id', user.id)
          }
        }
      }
    }
    init()
  }, [code])

  if (loading) return (
    <main style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui'}}>
      <p style={{color:'#999', fontSize:'14px'}}>Chargement des résultats...</p>
    </main>
  )

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#fff', fontFamily:'system-ui, sans-serif'}}>
      <nav style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'24px 48px', borderBottom:'1px solid #f0f0f0'}}>
        <div style={{display:'flex', alignItems:'baseline', gap:'2px'}}>
          <span style={{fontSize:'22px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>obladi</span>
          <span style={{fontSize:'22px', fontWeight:'500', color:'#3b82f6'}}>.</span>
          <span style={{fontSize:'13px', color:'#999'}}>app</span>
        </div>
        <span style={{fontSize:'13px', color:'#999'}}>{room?.playlists?.name}</span>
      </nav>

      <div style={{maxWidth:'600px', margin:'0 auto', padding:'48px'}}>
        <div style={{textAlign:'center', marginBottom:'48px'}}>
          <div style={{fontSize:'48px', marginBottom:'16px'}}>🏁</div>
          <h1 style={{fontSize:'32px', fontWeight:'500', letterSpacing:'-1px', color:'#111', marginBottom:'8px'}}>Résultats finals</h1>
          <p style={{fontSize:'14px', color:'#999'}}>Room {code.toUpperCase()} · {room?.playlists?.name}</p>
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
                  <span style={{fontSize:'13px', fontWeight:'500', color:'#111'}}>{p.profiles?.pseudo}</span>
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
        <div style={{border:'1px solid #f0f0f0', borderRadius:'12px', overflow:'hidden', marginBottom:'32px'}}>
          {players.map((p, i) => (
            <div key={p.id} style={{display:'flex', alignItems:'center', gap:'12px', padding:'14px 20px', borderBottom: i < players.length - 1 ? '1px solid #f8f8f8' : 'none', backgroundColor: i === 0 ? '#fffbeb' : 'white'}}>
              <span style={{fontSize:'18px', width:'24px', textAlign:'center'}}>{MEDALS[i] || i + 1}</span>
              <span style={{fontSize:'24px'}}>{AVATARS[p.profiles?.avatar_id] || '🎵'}</span>
              <div style={{flex:1}}>
                <p style={{fontSize:'14px', fontWeight:'500', color:'#111'}}>{p.profiles?.pseudo}</p>
              </div>
              <p style={{fontSize:'16px', fontWeight:'500', color:'#111'}}>{p.score} pts</p>
            </div>
          ))}
        </div>

        <div style={{display:'flex', gap:'8px'}}>
          <a href="/dashboard" style={{flex:1, padding:'12px', backgroundColor:'#111', color:'#fff', borderRadius:'8px', fontSize:'14px', fontWeight:'500', textDecoration:'none', textAlign:'center'}}>
            Mon profil
          </a>
          <a href="/" style={{flex:1, padding:'12px', backgroundColor:'transparent', color:'#111', borderRadius:'8px', fontSize:'14px', border:'1px solid #e0e0e0', textDecoration:'none', textAlign:'center'}}>
            Accueil
          </a>
        </div>
      </div>
    </main>
  )
}
