'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../../lib/supabase'
import { generateRoomCode } from '../../../../lib/game'
import { useRouter } from 'next/navigation'

export default function NewRoom() {
  const [playlists, setPlaylists] = useState([])
  const [selectedPlaylist, setSelectedPlaylist] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState(null)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('playlists').select('*').order('created_at', { ascending: false })
      setPlaylists(data || [])
    }
    load()
  }, [])

  async function createRoom() {
    if (!selectedPlaylist) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); alert('Session expirée, reconnecte-toi.'); router.push('/login'); return }
    const code = generateRoomCode()
    const { data, error } = await supabase.from('rooms').insert({
      code,
      host_id: user.id,
      playlist_id: selectedPlaylist,
      status: 'waiting',
      title: title || playlists.find(p => p.id === selectedPlaylist)?.name || 'Partie sans titre'
    }).select().single()
    setCreated(data)
    setLoading(false)
  }

  const roomUrl = created ? `${typeof window !== 'undefined' ? window.location.origin : ''}/room/${created.code}` : ''

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#fff', fontFamily:'system-ui, sans-serif'}}>
      <style>{`
        @media (max-width: 768px) {
          .nr-nav { padding: 16px 24px !important; }
          .nr-container { padding: 24px 16px !important; }
        }
      `}</style>
      <nav className="nr-nav" style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'24px 48px', borderBottom:'1px solid #f0f0f0'}}>
        <a href="/" style={{display:'flex', alignItems:'baseline', gap:'2px', textDecoration:'none'}}>
          <span style={{fontSize:'22px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>obladi</span>
          <span style={{fontSize:'22px', fontWeight:'500', color:'#3b82f6'}}>.</span>
          <span style={{fontSize:'13px', color:'#999'}}>app</span>
        </a>
        <span style={{fontSize:'12px', color:'#999', textTransform:'uppercase', letterSpacing:'0.08em'}}>Admin · Nouvelle room</span>
      </nav>

      <div className="nr-container" style={{maxWidth:'600px', margin:'0 auto', padding:'48px'}}>
        {!created ? (
          <>
            <h1 style={{fontSize:'28px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111', marginBottom:'8px'}}>Créer une room</h1>
            <p style={{fontSize:'14px', color:'#666', marginBottom:'32px'}}>Choisis une playlist, crée la room et partage le lien à tes joueurs.</p>

            <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
              <label style={{fontSize:'13px', fontWeight:'500', color:'#111'}}>Titre de la partie</label>
              <input
                placeholder="Ex: Soirée années 90, Battle musicale..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={{width:'100%', padding:'12px 16px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'16px', outline:'none', color:'#111', boxSizing:'border-box'}}
              />
              <label style={{fontSize:'13px', fontWeight:'500', color:'#111'}}>Playlist</label>
              <select
                value={selectedPlaylist}
                onChange={e => setSelectedPlaylist(e.target.value)}
                style={{width:'100%', padding:'12px 16px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'16px', outline:'none', backgroundColor:'#fff', color:'#111', boxSizing:'border-box'}}
              >
                <option value="">Sélectionne une playlist...</option>
                {playlists.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.songs_count} chansons)</option>
                ))}
              </select>

              <button
                onClick={createRoom}
                disabled={!selectedPlaylist || loading}
                style={{width:'100%', padding:'14px', backgroundColor: selectedPlaylist ? '#111' : '#ccc', color:'#fff', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'500', cursor: selectedPlaylist ? 'pointer' : 'default', marginTop:'8px'}}
              >
                {loading ? 'Création...' : 'Créer la room →'}
              </button>
              <button
                onClick={() => router.push('/admin')}
                style={{width:'100%', padding:'12px', backgroundColor:'transparent', color:'#999', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'13px', cursor:'pointer'}}
              >
                Annuler
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{textAlign:'center', marginBottom:'32px'}}>
              <div style={{fontSize:'64px', fontWeight:'500', letterSpacing:'8px', color:'#111', marginBottom:'8px'}}>{created.code}</div>
              <p style={{fontSize:'14px', color:'#666'}}>Code de la room — les joueurs peuvent entrer ce code sur obladi.app</p>
            </div>

            <div style={{padding:'16px', backgroundColor:'#f8f8f8', borderRadius:'8px', marginBottom:'24px'}}>
              <p style={{fontSize:'12px', color:'#999', marginBottom:'6px'}}>Lien direct à partager</p>
              <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                <p style={{fontSize:'13px', color:'#111', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{roomUrl}</p>
                <button
                  onClick={() => navigator.clipboard.writeText(roomUrl)}
                  style={{padding:'6px 14px', backgroundColor:'#111', color:'#fff', border:'none', borderRadius:'6px', fontSize:'12px', cursor:'pointer', flexShrink:0}}
                >
                  Copier
                </button>
              </div>
            </div>

            <button
              onClick={() => router.push(`/admin/room/${created.code}/host`)}
              style={{width:'100%', padding:'14px', backgroundColor:'#111', color:'#fff', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'500', cursor:'pointer'}}
            >
              Gérer la room →
            </button>
          </>
        )}
      </div>
    </main>
  )
}
