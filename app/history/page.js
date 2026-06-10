'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function History() {
  const router = useRouter()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: hist } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('player_id', user.id)
        .eq('completed', true)
        .order('played_at', { ascending: false })
      setSessions(hist || [])
      setLoading(false)
    }
    init()
  }, [])

  function formatDate(dateStr) {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return (
    <main style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui'}}>
      <p style={{color:'#999', fontSize:'14px'}}>Chargement...</p>
    </main>
  )

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#fff', fontFamily:'system-ui, sans-serif'}}>
      <style>{`
        .hist-session-clickable { cursor: pointer; transition: background-color 0.15s; }
        .hist-session-clickable:hover { background-color: #f8f8f8; }
        @media (max-width: 768px) {
          .hist-nav { padding: 16px 24px !important; }
          .hist-container { padding: 24px 16px !important; }
          .hist-session { padding: 12px 14px !important; gap: 12px !important; }
        }
      `}</style>

      <nav className="hist-nav" style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'24px 48px', borderBottom:'1px solid #f0f0f0'}}>
        <button onClick={() => router.push('/dashboard')} style={{background:'none', border:'none', cursor:'pointer', fontSize:'14px', color:'#666'}}>← Retour</button>
        <a href="/" style={{display:'flex', alignItems:'baseline', gap:'2px', textDecoration:'none'}}>
          <span style={{fontSize:'18px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>obladi</span>
          <span style={{fontSize:'18px', fontWeight:'500', color:'#3b82f6'}}>.</span>
        </a>
      </nav>

      <div className="hist-container" style={{maxWidth:'600px', margin:'0 auto', padding:'48px'}}>
        <h1 style={{fontSize:'28px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111', marginBottom:'8px'}}>Mes parties</h1>
        <p style={{fontSize:'14px', color:'#999', marginBottom:'32px'}}>{sessions.length} partie{sessions.length > 1 ? 's' : ''} terminée{sessions.length > 1 ? 's' : ''}</p>

        {sessions.length === 0 ? (
          <div style={{padding:'48px 24px', border:'1px solid #f0f0f0', borderRadius:'12px', textAlign:'center'}}>
            <p style={{fontSize:'14px', color:'#999'}}>Tu n'as pas encore terminé de partie.</p>
          </div>
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
            {sessions.map(s => (
              <div key={s.id} className={`hist-session ${s.room_code ? 'hist-session-clickable' : ''}`} onClick={() => s.room_code && router.push(`/room/${s.room_code}/recap`)} style={{display:'flex', alignItems:'center', gap:'16px', padding:'16px 20px', border:'1px solid #f0f0f0', borderRadius:'12px'}}>
                <div style={{width:'40px', height:'40px', backgroundColor:'#f0f0f0', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0}}>
                  🎵
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <p style={{fontSize:'14px', fontWeight:'500', color:'#111', marginBottom:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.theme || 'Général'}</p>
                  <p style={{fontSize:'12px', color:'#999'}}>{formatDate(s.played_at)}</p>
                </div>
                <div style={{textAlign:'right', flexShrink:0}}>
                  <p style={{fontSize:'16px', fontWeight:'500', color:'#111'}}>{s.score} pts</p>
                </div>
                {s.room_code && <span style={{fontSize:'18px', color:'#ccc', flexShrink:0}}>→</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
