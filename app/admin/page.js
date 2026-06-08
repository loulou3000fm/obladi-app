'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Admin() {
  const [playlists, setPlaylists] = useState([])
  const [rooms, setRooms] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [theme, setTheme] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('rooms')
  const router = useRouter()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    await loadRooms()
    await loadPlaylists()
  }

  async function loadRooms() {
    const supabase = createClient()
    const { data } = await supabase
      .from('rooms')
      .select('*, playlists(name)')
      .order('created_at', { ascending: false })
    setRooms(data || [])
  }

  async function loadPlaylists() {
    const supabase = createClient()
    const { data } = await supabase.from('playlists').select('*').order('created_at', { ascending: false })
    setPlaylists(data || [])
  }

  async function createPlaylist(e) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('playlists').insert({ name, theme }).select().single()
    router.push('/admin/playlist/' + data.id)
  }

  async function deletePlaylist(id) {
    const supabase = createClient()
    await supabase.from('playlists').delete().eq('id', id)
    setPlaylists(prev => prev.filter(p => p.id !== id))
  }

  async function deleteRoom(id) {
    if (!confirm('Supprimer cette room ?')) return
    setRooms(prev => prev.filter(r => r.id !== id))
    const res = await fetch('/api/delete-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: id })
    })
    const data = await res.json()
    if (data.error) {
      console.error('deleteRoom error:', data.error)
      loadRooms()
    }
  }

  const statusLabel = { waiting: 'En attente', playing: '● En cours', finished: 'Terminée', interrupted: 'Interrompue' }
  const statusColor = { waiting: '#666', playing: '#16a34a', finished: '#3b82f6', interrupted: '#ef4444' }
  const statusBg = { waiting: '#f0f0f0', playing: '#f0fdf4', finished: '#eff6ff', interrupted: '#fef2f2' }

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#fff', fontFamily:'system-ui, sans-serif'}}>
      <style>{`
        @media (max-width: 768px) {
          .admin-nav { padding: 16px 24px !important; }
          .admin-nav-actions { gap: 6px !important; flex-wrap: wrap !important; justify-content: flex-end !important; }
          .admin-tag { display: none !important; }
          .admin-container { padding: 24px 16px !important; }
          .admin-tabs { width: 100% !important; }
          .admin-tab { flex: 1 !important; }
          .admin-card { flex-direction: column !important; align-items: stretch !important; }
        }
      `}</style>
      <nav className="admin-nav" style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'24px 48px', borderBottom:'1px solid #f0f0f0'}}>
        <a href="/" style={{display:'flex', alignItems:'baseline', gap:'2px', textDecoration:'none'}}>
          <span style={{fontSize:'22px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>obladi</span>
          <span style={{fontSize:'22px', fontWeight:'500', color:'#3b82f6'}}>.</span>
          <span style={{fontSize:'13px', color:'#999'}}>app</span>
        </a>
        <div className="admin-nav-actions" style={{display:'flex', alignItems:'center', gap:'8px'}}>
          <a href="/admin/stats"
            style={{padding:'6px 12px', backgroundColor:'transparent', border:'1px solid #e0e0e0', borderRadius:'6px', fontSize:'11px', cursor:'pointer', color:'#999', textDecoration:'none'}}>
            Stats
          </a>
          <button
            onClick={async () => {
              const pwd = prompt('Nouveau mot de passe :')
              if (!pwd) return
              const supabase = createClient()
              const { error } = await supabase.auth.updateUser({ password: pwd })
              if (error) alert('Erreur : ' + error.message)
              else alert('Mot de passe mis à jour !')
            }}
            style={{padding:'6px 12px', backgroundColor:'transparent', border:'1px solid #e0e0e0', borderRadius:'6px', fontSize:'11px', cursor:'pointer', color:'#999'}}
          >
            Mot de passe
          </button>
          <button
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              router.push('/login')
            }}
            style={{padding:'6px 12px', backgroundColor:'transparent', border:'1px solid #e0e0e0', borderRadius:'6px', fontSize:'11px', cursor:'pointer', color:'#999'}}
          >
            Déconnexion
          </button>
          <span className="admin-tag" style={{fontSize:'12px', color:'#999', textTransform:'uppercase', letterSpacing:'0.08em'}}>Admin</span>
        </div>
      </nav>

      <div className="admin-container" style={{maxWidth:'900px', margin:'0 auto', padding:'48px'}}>

        {/* Tabs */}
        <div className="admin-tabs" style={{display:'flex', gap:'4px', marginBottom:'32px', backgroundColor:'#f8f8f8', padding:'4px', borderRadius:'10px', width:'fit-content'}}>
          {['rooms', 'playlists'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className="admin-tab"
              style={{padding:'8px 20px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'500',
                backgroundColor: activeTab === tab ? '#fff' : 'transparent',
                color: activeTab === tab ? '#111' : '#999',
                boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'}}>
              {tab === 'rooms' ? `Parties (${rooms.length})` : `Playlists (${playlists.length})`}
            </button>
          ))}
        </div>

        {activeTab === 'rooms' && (
          <div>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px'}}>
              <h1 style={{fontSize:'24px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>Parties</h1>
              <a href="/admin/room/new" style={{backgroundColor:'#3b82f6', color:'#fff', padding:'10px 20px', borderRadius:'8px', fontSize:'14px', textDecoration:'none', display:'inline-block'}}>
                🎵 Créer une room
              </a>
            </div>

            <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
              {rooms.length === 0 && (
                <div style={{padding:'48px', border:'1px solid #f0f0f0', borderRadius:'12px', textAlign:'center'}}>
                  <p style={{fontSize:'14px', color:'#999'}}>Aucune partie créée. Lance ta première room !</p>
                </div>
              )}
              {rooms.map(r => (
                <div key={r.id} className="admin-card" style={{display:'flex', alignItems:'center', padding:'20px 24px', border:'1px solid #f0f0f0', borderRadius:'12px', gap:'16px'}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px'}}>
                      <p style={{fontSize:'15px', fontWeight:'500', color:'#111'}}>{r.title || r.playlists?.name}</p>
                      <span style={{fontSize:'11px', padding:'2px 8px', borderRadius:'99px', backgroundColor: statusBg[r.status], color: statusColor[r.status]}}>
                        {statusLabel[r.status]}
                      </span>
                    </div>
                    <p style={{fontSize:'12px', color:'#999'}}>
                      Playlist : {r.playlists?.name} · Code : <strong style={{letterSpacing:'2px', color:'#111'}}>{r.code}</strong>
                    </p>
                  </div>
                  <div style={{display:'flex', gap:'6px'}}>
                    {(r.status === 'waiting' || r.status === 'playing') && (
                      <button onClick={() => router.push(`/admin/room/${r.code}/host`)}
                        style={{padding:'8px 14px', backgroundColor:'#111', color:'#fff', border:'none', borderRadius:'6px', fontSize:'12px', cursor:'pointer'}}>
                        Gérer →
                      </button>
                    )}
                    {r.status === 'finished' && (
                      <button onClick={() => router.push(`/admin/room/${r.code}/results`)}
                        style={{padding:'8px 14px', backgroundColor:'#3b82f6', color:'#fff', border:'none', borderRadius:'6px', fontSize:'12px', cursor:'pointer'}}>
                        Résultats
                      </button>
                    )}
                    <button onClick={() => deleteRoom(r.id)}
                      style={{padding:'8px 14px', backgroundColor:'transparent', border:'1px solid #fee2e2', borderRadius:'6px', fontSize:'12px', cursor:'pointer', color:'#ef4444'}}>
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'playlists' && (
          <div>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px'}}>
              <h1 style={{fontSize:'24px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>Playlists</h1>
              <button onClick={() => setShowCreate(!showCreate)}
                style={{backgroundColor:'#111', color:'#fff', padding:'10px 20px', borderRadius:'8px', fontSize:'14px', border:'none', cursor:'pointer'}}>
                + Nouvelle playlist
              </button>
            </div>

            {showCreate && (
              <form onSubmit={createPlaylist} style={{padding:'24px', border:'1px solid #e8e8e8', borderRadius:'12px', marginBottom:'24px', display:'flex', flexDirection:'column', gap:'12px'}}>
                <h3 style={{fontSize:'16px', fontWeight:'500', color:'#111', margin:0}}>Nouvelle playlist</h3>
                <input placeholder="Nom de la playlist" value={name} onChange={e => setName(e.target.value)} required
                  style={{padding:'10px 14px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'14px', outline:'none'}} />
                <input placeholder="Thème (optionnel)" value={theme} onChange={e => setTheme(e.target.value)}
                  style={{padding:'10px 14px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'14px', outline:'none'}} />
                <div style={{display:'flex', gap:'8px'}}>
                  <button type="submit" disabled={loading}
                    style={{backgroundColor:'#111', color:'#fff', padding:'10px 20px', borderRadius:'8px', fontSize:'14px', border:'none', cursor:'pointer'}}>
                    {loading ? 'Création...' : 'Créer'}
                  </button>
                  <button type="button" onClick={() => setShowCreate(false)}
                    style={{backgroundColor:'transparent', color:'#666', padding:'10px 20px', borderRadius:'8px', fontSize:'14px', border:'1px solid #e0e0e0', cursor:'pointer'}}>
                    Annuler
                  </button>
                </div>
              </form>
            )}

            <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
              {playlists.map(p => (
                <div key={p.id} className="admin-card" style={{display:'flex', alignItems:'center', padding:'20px 24px', border:'1px solid #f0f0f0', borderRadius:'12px', gap:'16px'}}>
                  <div style={{flex:1}}>
                    <p style={{fontSize:'15px', fontWeight:'500', color:'#111', margin:'0 0 4px'}}>{p.name}</p>
                    <p style={{fontSize:'13px', color:'#999', margin:0}}>{p.theme || 'Pas de thème'} · {p.songs_count} chansons</p>
                  </div>
                  <div style={{display:'flex', gap:'6px'}}>
                    <button onClick={() => router.push(`/admin/playlist/${p.id}`)}
                      style={{padding:'8px 16px', backgroundColor:'#f8f8f8', border:'1px solid #e8e8e8', borderRadius:'8px', fontSize:'13px', cursor:'pointer', color:'#111'}}>
                      Gérer →
                    </button>
                    <button onClick={() => deletePlaylist(p.id)}
                      style={{padding:'8px 16px', backgroundColor:'transparent', border:'1px solid #fee2e2', borderRadius:'8px', fontSize:'13px', cursor:'pointer', color:'#ef4444'}}>
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
