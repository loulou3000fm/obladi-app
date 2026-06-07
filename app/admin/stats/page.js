'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

const AVATARS = { avatar_1:'🎵', avatar_2:'🎸', avatar_3:'🎹', avatar_4:'🥁', avatar_5:'🎺', avatar_6:'🎻', avatar_7:'🎤', avatar_8:'🎧' }
const MEDALS = ['🥇', '🥈', '🥉']

export default function Stats() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [openGame, setOpenGame] = useState(null)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const res = await fetch('/api/stats', { cache: 'no-store' })
      const json = await res.json()
      if (json.error) { setError(json.error); setLoading(false); return }
      setData(json)
      setLoading(false)
    }
    load()
  }, [])

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return (
    <main style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui, sans-serif'}}>
      <p style={{color:'#999', fontSize:'14px'}}>Chargement...</p>
    </main>
  )

  if (error) return (
    <main style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui, sans-serif'}}>
      <p style={{color:'#ef4444', fontSize:'14px'}}>Erreur : {error}</p>
    </main>
  )

  const SongRow = ({ s, i }) => (
    <div style={{display:'flex', alignItems:'center', gap:'12px', padding:'12px 0', borderBottom:'1px solid #f0f0f0'}}>
      <span style={{fontSize:'13px', color:'#999', width:'18px'}}>{i + 1}</span>
      <div style={{flex:1, minWidth:0}}>
        <p style={{fontSize:'14px', fontWeight:'500', color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.title}</p>
        <p style={{fontSize:'12px', color:'#999', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.artist}</p>
      </div>
      <span style={{fontSize:'13px', fontWeight:'500', color:'#3b82f6', flexShrink:0}}>{s.count} ✓</span>
    </div>
  )

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#fff', fontFamily:'system-ui, sans-serif'}}>
      <style>{`
        @media (max-width: 768px) {
          .stats-nav { padding: 16px 24px !important; }
          .stats-container { padding: 24px 16px !important; }
          .stats-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <nav className="stats-nav" style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'24px 48px', borderBottom:'1px solid #f0f0f0'}}>
        <a href="/" style={{display:'flex', alignItems:'baseline', gap:'2px', textDecoration:'none'}}>
          <span style={{fontSize:'22px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>obladi</span>
          <span style={{fontSize:'22px', fontWeight:'500', color:'#3b82f6'}}>.</span>
          <span style={{fontSize:'13px', color:'#999'}}>app</span>
        </a>
        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
          <a href="/admin" style={{padding:'6px 12px', backgroundColor:'transparent', border:'1px solid #e0e0e0', borderRadius:'6px', fontSize:'11px', cursor:'pointer', color:'#999', textDecoration:'none'}}>
            ← Admin
          </a>
          <span style={{fontSize:'12px', color:'#999', textTransform:'uppercase', letterSpacing:'0.08em'}}>Stats</span>
        </div>
      </nav>

      <div className="stats-container" style={{maxWidth:'900px', margin:'0 auto', padding:'48px'}}>

        {/* Section 1 — Stats globales */}
        <h1 style={{fontSize:'24px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111', marginBottom:'24px'}}>Stats globales</h1>

        <div className="stats-grid" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'24px'}}>
          <div style={{padding:'24px', border:'1px solid #f0f0f0', borderRadius:'12px'}}>
            <h2 style={{fontSize:'15px', fontWeight:'500', color:'#111', marginBottom:'12px'}}>🔥 Top 5 les plus trouvées</h2>
            {data.topFound.length === 0
              ? <p style={{fontSize:'13px', color:'#999'}}>Aucune donnée.</p>
              : data.topFound.map((s, i) => <SongRow key={s.song_id} s={s} i={i} />)
            }
          </div>
          <div style={{padding:'24px', border:'1px solid #f0f0f0', borderRadius:'12px'}}>
            <h2 style={{fontSize:'15px', fontWeight:'500', color:'#111', marginBottom:'12px'}}>🧊 Top 5 les moins trouvées</h2>
            {data.leastFound.length === 0
              ? <p style={{fontSize:'13px', color:'#999'}}>Aucune donnée.</p>
              : data.leastFound.map((s, i) => <SongRow key={s.song_id} s={s} i={i} />)
            }
          </div>
        </div>

        <div style={{padding:'24px', border:'1px solid #f0f0f0', borderRadius:'12px', marginBottom:'48px'}}>
          <h2 style={{fontSize:'15px', fontWeight:'500', color:'#111', marginBottom:'12px'}}>🏆 Top 5 meilleurs joueurs</h2>
          {data.topPlayers.length === 0
            ? <p style={{fontSize:'13px', color:'#999'}}>Aucune donnée.</p>
            : data.topPlayers.map((p, i) => (
              <div key={p.player_id} style={{display:'flex', alignItems:'center', gap:'12px', padding:'12px 0', borderBottom:'1px solid #f0f0f0'}}>
                <span style={{fontSize:'16px', width:'24px', textAlign:'center'}}>{MEDALS[i] || `${i + 1}`}</span>
                <span style={{fontSize:'20px'}}>{AVATARS[p.avatar_id] || '🎵'}</span>
                <p style={{flex:1, fontSize:'14px', fontWeight:'500', color:'#111'}}>{p.pseudo}</p>
                <span style={{fontSize:'14px', fontWeight:'500', color:'#3b82f6'}}>{p.points} pts</span>
              </div>
            ))
          }
        </div>

        {/* Section 2 — Stats par partie */}
        <h1 style={{fontSize:'24px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111', marginBottom:'24px'}}>Stats par partie</h1>

        {data.games.length === 0 ? (
          <div style={{padding:'48px', border:'1px solid #f0f0f0', borderRadius:'12px', textAlign:'center'}}>
            <p style={{fontSize:'14px', color:'#999'}}>Aucune partie terminée pour le moment.</p>
          </div>
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
            {data.games.map(game => {
              const open = openGame === game.id
              return (
                <div key={game.id} style={{border:'1px solid #f0f0f0', borderRadius:'12px', overflow:'hidden'}}>
                  <button
                    onClick={() => setOpenGame(open ? null : game.id)}
                    style={{display:'flex', alignItems:'center', gap:'16px', width:'100%', padding:'20px 24px', backgroundColor: open ? '#f8f8f8' : '#fff', border:'none', cursor:'pointer', textAlign:'left'}}
                  >
                    <div style={{flex:1}}>
                      <p style={{fontSize:'15px', fontWeight:'500', color:'#111', marginBottom:'4px'}}>{game.title}</p>
                      <p style={{fontSize:'12px', color:'#999'}}>{formatDate(game.date)} · {game.playerCount} joueur{game.playerCount > 1 ? 's' : ''} · Code {game.code}</p>
                    </div>
                    <span style={{fontSize:'13px', color:'#999'}}>{open ? '▲' : '▼'}</span>
                  </button>

                  {open && (
                    <div style={{padding:'0 24px 24px'}}>
                      {/* Classement final */}
                      <h3 style={{fontSize:'13px', fontWeight:'500', color:'#999', textTransform:'uppercase', letterSpacing:'0.06em', margin:'16px 0 12px'}}>Classement final</h3>
                      {game.ranking.length === 0
                        ? <p style={{fontSize:'13px', color:'#999'}}>Aucun joueur.</p>
                        : game.ranking.map((p, i) => (
                          <div key={p.player_id} style={{display:'flex', alignItems:'center', gap:'12px', padding:'8px 0', borderBottom:'1px solid #f0f0f0'}}>
                            <span style={{fontSize:'15px', width:'24px', textAlign:'center'}}>{MEDALS[i] || `${i + 1}`}</span>
                            <span style={{fontSize:'18px'}}>{AVATARS[p.avatar_id] || '🎵'}</span>
                            <p style={{flex:1, fontSize:'13px', fontWeight:'500', color:'#111'}}>{p.pseudo}</p>
                            <span style={{fontSize:'13px', fontWeight:'500', color:'#3b82f6'}}>{p.score} pts</span>
                          </div>
                        ))
                      }

                      {/* Taux de réussite par chanson */}
                      <h3 style={{fontSize:'13px', fontWeight:'500', color:'#999', textTransform:'uppercase', letterSpacing:'0.06em', margin:'24px 0 12px'}}>Taux de réussite par chanson</h3>
                      {game.songs.length === 0
                        ? <p style={{fontSize:'13px', color:'#999'}}>Aucune chanson.</p>
                        : game.songs.map((s, i) => (
                          <div key={s.song_id} style={{display:'flex', alignItems:'center', gap:'12px', padding:'10px 0', borderBottom:'1px solid #f0f0f0'}}>
                            <span style={{fontSize:'13px', color:'#999', width:'18px'}}>{i + 1}</span>
                            <div style={{flex:1, minWidth:0}}>
                              <p style={{fontSize:'13px', fontWeight:'500', color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.title}</p>
                              <p style={{fontSize:'12px', color:'#999', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.artist}</p>
                            </div>
                            <div style={{display:'flex', alignItems:'center', gap:'8px', flexShrink:0}}>
                              <div style={{width:'80px', height:'6px', backgroundColor:'#f0f0f0', borderRadius:'99px', overflow:'hidden'}}>
                                <div style={{height:'6px', width:`${s.rate}%`, backgroundColor:'#3b82f6'}} />
                              </div>
                              <span style={{fontSize:'12px', fontWeight:'500', color:'#111', width:'80px', textAlign:'right'}}>{s.rate}% ({s.found}/{s.total})</span>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>
    </main>
  )
}
