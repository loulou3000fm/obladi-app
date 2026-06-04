'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '../../../../lib/supabase'
import { useParams, useRouter } from 'next/navigation'

export default function PlaylistAdmin() {
  const { id } = useParams()
  const router = useRouter()
  const [playlist, setPlaylist] = useState(null)
  const [songs, setSongs] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const searchTimeout = useRef(null)
  const [spotifyUrl, setSpotifyUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [playingId, setPlayingId] = useState(null)
  const [editingYoutube, setEditingYoutube] = useState(null)
  const [youtubeInput, setYoutubeInput] = useState('')
  const playerRef = useRef(null)

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const supabase = createClient()
    const { data: pl } = await supabase.from('playlists').select('*').eq('id', id).single()
    const { data: sg } = await supabase.from('songs').select('*').eq('playlist_id', id).order('created_at', { ascending: false })
    setPlaylist(pl)
    setSongs(sg || [])
  }

  function handleSearchInput(e) {
    const value = e.target.value
    setSearchQuery(value)
    if (!value.trim()) {
      setSearchResults([])
      return
    }
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      const res = await fetch(`/api/music?type=search&q=${encodeURIComponent(value)}`)
      const data = await res.json()
      setSearchResults(data)
      setSearching(false)
    }, 500)
  }

  async function addSong(track) {
    const supabase = createClient()
    const song = {
      playlist_id: id,
      spotify_id: track.id,
      title: track.name,
      artist: track.artists[0].name,
      album: track.album.name,
      cover_url: track.album.images[0]?.url,
      preview_url: track.preview_url || null,
      duration_ms: track.duration_ms,
      youtube_id: track.youtube_id || null
    }
    const { data } = await supabase.from('songs').insert(song).select().single()
    setSongs(prev => [data, ...prev])
    await supabase.from('playlists').update({ songs_count: songs.length + 1 }).eq('id', id)
    setPlaylist(prev => ({ ...prev, songs_count: (prev.songs_count || 0) + 1 }))
  }

  async function importPlaylist() {
    const cleanUrl = spotifyUrl.split('?')[0].split('/s/')[0]
    const match = cleanUrl.match(/playlist\/(\d+)/)
    if (!match) return alert('URL Spotify invalide')
    setImporting(true)
    const playlistId = match[1]
    const res = await fetch(`/api/music?type=playlist&id=${playlistId}`)
    const tracks = await res.json()

    if (!tracks || tracks.length === 0) {
      alert('Aucune chanson trouvée dans cette playlist')
      setImporting(false)
      return
    }

    const supabase = createClient()
    const songsToInsert = tracks.map(t => ({ ...t, playlist_id: id }))
    const { error } = await supabase.from('songs').insert(songsToInsert)

    if (error) {
      alert('Erreur: ' + error.message)
      setImporting(false)
      return
    }

    await supabase.from('playlists').update({ songs_count: songs.length + songsToInsert.length }).eq('id', id)
    setImportedCount(songsToInsert.length)
    setImporting(false)
    setSpotifyUrl('')
    loadData()
  }

  async function deleteSong(songId) {
    const supabase = createClient()
    await supabase.from('songs').delete().eq('id', songId)
    setSongs(prev => prev.filter(s => s.id !== songId))
  }

  async function updateYoutubeId(songId) {
    const match = youtubeInput.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    const youtubeId = match ? match[1] : youtubeInput.trim()
    if (!youtubeId) return
    const supabase = createClient()
    await supabase.from('songs').update({ youtube_id: youtubeId }).eq('id', songId)
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, youtube_id: youtubeId } : s))
    setEditingYoutube(null)
    setYoutubeInput('')
  }

  function togglePreview(song) {
    if (!song.youtube_id) return
    if (playingId === song.id) {
      setPlayingId(null)
    } else {
      setPlayingId(song.id)
    }
  }

  if (!playlist) return <div style={{padding:'48px', fontFamily:'system-ui', color:'#999', fontSize:'14px'}}>Chargement...</div>

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#fff', fontFamily:'system-ui, sans-serif'}}>
      <nav style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'24px 48px', borderBottom:'1px solid #f0f0f0'}}>
        <div style={{display:'flex', alignItems:'center', gap:'16px'}}>
          <button onClick={() => router.push('/admin')} style={{background:'none', border:'none', cursor:'pointer', fontSize:'14px', color:'#666'}}>← Admin</button>
          <span style={{color:'#e0e0e0'}}>/</span>
          <span style={{fontSize:'15px', fontWeight:'500', color:'#111'}}>{playlist.name}</span>
        </div>
        <span style={{fontSize:'13px', color:'#999'}}>{songs.length} chansons</span>
      </nav>

      <div style={{maxWidth:'900px', margin:'0 auto', padding:'48px'}}>

        {/* Import Spotify */}
        <div style={{padding:'24px', backgroundColor:'#f8f8f8', borderRadius:'12px', marginBottom:'32px'}}>
          <h3 style={{fontSize:'14px', fontWeight:'500', color:'#111', margin:'0 0 4px'}}>Importer une playlist Deezer</h3>
          <p style={{fontSize:'12px', color:'#999', margin:'0 0 12px'}}>Les métadonnées et previews viennent de Deezer, le reveal depuis YouTube.</p>
          <div style={{display:'flex', gap:'8px'}}>
            <input
              placeholder="https://www.deezer.com/fr/playlist/..."
              value={spotifyUrl}
              onChange={e => setSpotifyUrl(e.target.value)}
              style={{flex:1, padding:'10px 14px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'14px', outline:'none', backgroundColor:'#fff'}}
            />
            <button onClick={importPlaylist} disabled={importing} style={{padding:'10px 20px', backgroundColor:'#1DB954', color:'#fff', border:'none', borderRadius:'8px', fontSize:'14px', cursor:'pointer', fontWeight:'500', minWidth:'100px'}}>
              {importing ? '⏳ Import...' : 'Importer'}
            </button>
          </div>
          {importing && <p style={{fontSize:'12px', color:'#999', marginTop:'8px'}}>Recherche des vidéos YouTube en cours, cela peut prendre 30-60 secondes...</p>}
          {importedCount > 0 && <p style={{fontSize:'13px', color:'#1DB954', marginTop:'8px'}}>✓ {importedCount} chansons importées avec succès !</p>}
        </div>

        {/* Recherche manuelle */}
        <div style={{marginBottom:'32px'}}>
          <h3 style={{fontSize:'14px', fontWeight:'500', color:'#111', margin:'0 0 12px'}}>Ajouter une chanson manuellement</h3>
          <div style={{display:'flex', gap:'8px', marginBottom:'12px'}}>
            <input
              placeholder="Rechercher un titre ou un artiste..."
              value={searchQuery}
              onChange={handleSearchInput}
              style={{flex:1, padding:'10px 14px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'14px', outline:'none'}}
            />
            {searching && <span style={{display:'flex', alignItems:'center', fontSize:'13px', color:'#999', padding:'0 8px'}}>...</span>}
          </div>

          {searchResults.length > 0 && (
            <div style={{border:'1px solid #f0f0f0', borderRadius:'12px', overflow:'hidden', marginBottom:'16px'}}>
              {searchResults.map(track => (
                <div key={track.id} style={{display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px', borderBottom:'1px solid #f8f8f8'}}>
                  <div style={{width:'40px', height:'40px', borderRadius:'4px', backgroundColor:'#f0f0f0', flexShrink:0, overflow:'hidden'}}>
                    <img
                      src={track.album.images[0]?.url}
                      width={40}
                      height={40}
                      style={{width:'40px', height:'40px', objectFit:'cover'}}
                      alt=""
                      onError={e => e.target.style.display='none'}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div style={{flex:1, minWidth:0}}>
                    <p style={{fontSize:'13px', fontWeight:'500', color:'#111', margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{track.name}</p>
                    <p style={{fontSize:'12px', color:'#999', margin:0}}>{track.artists[0].name} · {track.album.name}</p>
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:'6px', flexShrink:0}}>
                    {track.youtube_id && (
                      <span style={{fontSize:'11px', color:'#1D9E75', backgroundColor:'#E1F5EE', padding:'2px 8px', borderRadius:'99px'}}>▶ YouTube</span>
                    )}
                    <button onClick={() => addSong(track)} style={{padding:'6px 14px', backgroundColor:'#111', color:'#fff', border:'none', borderRadius:'6px', fontSize:'12px', cursor:'pointer'}}>
                      + Ajouter
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Liste des chansons */}
        <div>
          <h3 style={{fontSize:'14px', fontWeight:'500', color:'#111', margin:'0 0 12px'}}>Chansons de la playlist</h3>
          {songs.length === 0 ? (
            <div style={{padding:'32px', border:'1px solid #f0f0f0', borderRadius:'12px', textAlign:'center'}}>
              <p style={{fontSize:'14px', color:'#999'}}>Aucune chanson encore.</p>
            </div>
          ) : (
            <div style={{border:'1px solid #f0f0f0', borderRadius:'12px', overflow:'hidden'}}>
              {songs.map((song, i) => (
                <div key={song.id} style={{display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px', borderBottom: i < songs.length-1 ? '1px solid #f8f8f8' : 'none'}}>
                  <div style={{width:'40px', height:'40px', borderRadius:'4px', backgroundColor:'#f0f0f0', flexShrink:0, overflow:'hidden'}}>
                    <img
                      src={song.cover_url}
                      width={40}
                      height={40}
                      style={{width:'40px', height:'40px', objectFit:'cover'}}
                      alt=""
                      onError={e => e.target.style.display='none'}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div style={{flex:1, minWidth:0}}>
                    <p style={{fontSize:'13px', fontWeight:'500', color:'#111', margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{song.title}</p>
                    <p style={{fontSize:'12px', color:'#999', margin:0}}>{song.artist} · {song.album}</p>
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:'6px', flexShrink:0}}>
                    {song.youtube_id ? (
                      <span style={{fontSize:'11px', color:'#1D9E75', backgroundColor:'#E1F5EE', padding:'2px 8px', borderRadius:'99px'}}>▶ YouTube</span>
                    ) : (
                      <span style={{fontSize:'11px', color:'#999', backgroundColor:'#f0f0f0', padding:'2px 8px', borderRadius:'99px'}}>Pas de vidéo</span>
                    )}
                    {playingId === song.id && song.youtube_id && (
                      <div style={{position:'fixed', bottom:'24px', right:'24px', zIndex:1000, backgroundColor:'#fff', border:'1px solid #e0e0e0', borderRadius:'12px', padding:'12px', boxShadow:'0 4px 20px rgba(0,0,0,0.1)'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
                          <p style={{fontSize:'12px', fontWeight:'500', color:'#111', margin:0}}>{song.title}</p>
                          <button onClick={() => setPlayingId(null)} style={{background:'none', border:'none', cursor:'pointer', fontSize:'16px', color:'#666'}}>×</button>
                        </div>
                        <iframe
                          width="280"
                          height="157"
                          src={`https://www.youtube.com/embed/${song.youtube_id}?autoplay=1`}
                          allow="autoplay"
                          style={{borderRadius:'8px', border:'none'}}
                        />
                      </div>
                    )}
                    <button onClick={() => togglePreview(song)} disabled={!song.youtube_id} style={{padding:'6px 14px', backgroundColor: playingId === song.id ? '#f0f9ff' : '#f8f8f8', border:'1px solid #e8e8e8', borderRadius:'6px', fontSize:'12px', cursor: song.youtube_id ? 'pointer' : 'default', color:'#111'}}>
                      {playingId === song.id ? '⏸ Stop' : '▶ Preview'}
                    </button>
                    {editingYoutube === song.id ? (
                      <div style={{display:'flex', gap:'4px', alignItems:'center'}}>
                        <input
                          value={youtubeInput}
                          onChange={e => setYoutubeInput(e.target.value)}
                          placeholder="URL ou ID YouTube..."
                          style={{padding:'4px 8px', border:'1px solid #e0e0e0', borderRadius:'6px', fontSize:'11px', width:'180px', outline:'none'}}
                          onKeyDown={e => e.key === 'Enter' && updateYoutubeId(song.id)}
                          autoFocus
                        />
                        <button onClick={() => updateYoutubeId(song.id)} style={{padding:'4px 10px', backgroundColor:'#111', color:'#fff', border:'none', borderRadius:'6px', fontSize:'11px', cursor:'pointer'}}>✓</button>
                        <button onClick={() => { setEditingYoutube(null); setYoutubeInput('') }} style={{padding:'4px 10px', backgroundColor:'transparent', border:'1px solid #e0e0e0', borderRadius:'6px', fontSize:'11px', cursor:'pointer'}}>✗</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingYoutube(song.id); setYoutubeInput(song.youtube_id || '') }} style={{padding:'6px 10px', backgroundColor:'transparent', border:'1px solid #e0e0e0', borderRadius:'6px', fontSize:'11px', cursor:'pointer', color:'#666'}}>
                        ✎ YT
                      </button>
                    )}
                    <button onClick={() => deleteSong(song.id)} style={{padding:'6px 14px', backgroundColor:'transparent', border:'1px solid #fee2e2', borderRadius:'6px', fontSize:'12px', cursor:'pointer', color:'#ef4444'}}>
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
