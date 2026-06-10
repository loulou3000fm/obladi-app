'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import SongModal from '../../components/SongModal'

export default function Favorites() {
  const router = useRouter()
  const [viewerId, setViewerId] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [selectedSong, setSelectedSong] = useState(null)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setViewerId(user.id)
      await load(user.id)
      setLoading(false)
    }
    init()
  }, [])

  async function load(uid) {
    const supabase = createClient()
    const { data: favRows } = await supabase
      .from('favorites')
      .select('song_id, created_at')
      .eq('player_id', uid)
      .order('created_at', { ascending: false })
    if (!favRows || favRows.length === 0) { setItems([]); return }
    const ids = favRows.map(f => f.song_id)
    const { data: songs } = await supabase.from('songs').select('id, title, artist, cover_url, deezer_id').in('id', ids)
    const map = {}
    for (const s of (songs || [])) map[s.id] = s
    setItems(favRows.map(f => ({ song: map[f.song_id], song_id: f.song_id, created_at: f.created_at })).filter(x => x.song))
  }

  async function removeFavorite(songId) {
    if (busy) return
    setBusy(songId)
    const prev = items
    setItems(items.filter(i => i.song_id !== songId)) // optimistic
    const supabase = createClient()
    const { error } = await supabase.from('favorites').delete().eq('player_id', viewerId).eq('song_id', songId)
    if (error) setItems(prev) // rollback
    setBusy(null)
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  if (loading) return (
    <main style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui'}}>
      <p style={{color:'#999', fontSize:'14px'}}>Chargement...</p>
    </main>
  )

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#fff', fontFamily:'system-ui, sans-serif'}}>
      <style>{`
        @media (max-width: 768px) {
          .fav-nav { padding: 16px 24px !important; }
          .fav-container { padding: 24px 16px !important; }
          .fav-date { display: none !important; }
        }
      `}</style>

      <nav className="fav-nav" style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'24px 48px', borderBottom:'1px solid #f0f0f0'}}>
        <button onClick={() => router.push('/dashboard')} style={{background:'none', border:'none', cursor:'pointer', fontSize:'14px', color:'#666'}}>← Retour</button>
        <a href="/" style={{display:'flex', alignItems:'baseline', gap:'2px', textDecoration:'none'}}>
          <span style={{fontSize:'18px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>obladi</span>
          <span style={{fontSize:'18px', fontWeight:'500', color:'#3b82f6'}}>.</span>
        </a>
      </nav>

      <div className="fav-container" style={{maxWidth:'600px', margin:'0 auto', padding:'48px'}}>
        <h1 style={{fontSize:'28px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111', marginBottom:'8px'}}>❤️ Mes favoris</h1>
        <p style={{fontSize:'14px', color:'#999', marginBottom:'32px'}}>{items.length} morceau{items.length > 1 ? 'x' : ''} enregistré{items.length > 1 ? 's' : ''}</p>

        {items.length === 0 ? (
          <div style={{padding:'48px 24px', border:'1px solid #f0f0f0', borderRadius:'12px', textAlign:'center'}}>
            <div style={{fontSize:'40px', marginBottom:'12px'}}>🤍</div>
            <p style={{fontSize:'14px', color:'#999'}}>Aucun favori pour le moment.<br />Mets des morceaux en favori pendant une partie pour les retrouver ici.</p>
          </div>
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
            {items.map(({ song, song_id, created_at }) => (
              <div key={song_id} className="fav-row" onClick={() => setSelectedSong({ ...song, created_at })} style={{display:'flex', alignItems:'center', gap:'14px', padding:'12px 16px', border:'1px solid #f0f0f0', borderRadius:'12px', cursor:'pointer'}}>
                {song.cover_url
                  ? <img src={song.cover_url} width={48} height={48} style={{width:'48px', height:'48px', borderRadius:'8px', objectFit:'cover', flexShrink:0}} referrerPolicy="no-referrer" alt="" />
                  : <div style={{width:'48px', height:'48px', backgroundColor:'#f0f0f0', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', flexShrink:0}}>🎵</div>
                }
                <div style={{flex:1, minWidth:0}}>
                  <p style={{fontSize:'14px', fontWeight:'500', color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{song.title}</p>
                  <p style={{fontSize:'12px', color:'#999', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{song.artist}</p>
                </div>
                <span className="fav-date" style={{fontSize:'12px', color:'#999', flexShrink:0}}>{formatDate(created_at)}</span>
                <button
                  onClick={e => { e.stopPropagation(); removeFavorite(song_id) }}
                  disabled={busy === song_id}
                  aria-label="Retirer des favoris"
                  style={{background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:'22px', lineHeight:1, flexShrink:0, padding:'4px', opacity: busy === song_id ? 0.5 : 1}}
                >
                  ♥
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <SongModal song={selectedSong} onClose={() => setSelectedSong(null)} />
    </main>
  )
}
