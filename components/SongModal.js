'use client'
import { useState, useEffect } from 'react'

export default function SongModal({ song, onClose }) {
  const [trackInfo, setTrackInfo] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!song) return
    setTrackInfo(null)
    if (!song.deezer_id && !song.artist) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/track-info?deezer_id=${song.deezer_id || ''}&artist=${encodeURIComponent(song.artist || '')}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setTrackInfo(data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [song?.deezer_id, song?.artist])

  if (!song) return null

  const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

  const yr = trackInfo?.releaseDate ? String(trackInfo.releaseDate).slice(0, 4) : null
  const metaParts = []
  if (yr && /^\d{4}$/.test(yr)) metaParts.push(`Sorti en ${yr}`)
  if (trackInfo?.label) metaParts.push(trackInfo.label)
  const meta = metaParts.join(' · ')
  const hasMembers = trackInfo?.members && trackInfo.members.length > 0
  const hasFacts = !!(meta || trackInfo?.origin || trackInfo?.yearsActive || hasMembers)

  return (
    <div className="song-modal-overlay" onClick={onClose} style={{position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px'}}>
      <style>{`
        @keyframes songmodal-in { from { opacity:0; transform: translateY(14px); } to { opacity:1; transform: translateY(0); } }
        .song-modal-card { animation: songmodal-in 0.2s ease forwards; }
        @media (max-width: 768px) {
          .song-modal-overlay { align-items: flex-end !important; padding: 0 !important; }
          .song-modal-card { width: 100% !important; max-width: 100% !important; border-radius: 20px 20px 0 0 !important; }
        }
      `}</style>

      <div
        className="song-modal-card"
        onClick={e => e.stopPropagation()}
        style={{position:'relative', backgroundColor:'#fff', borderRadius:'16px', padding:'28px', width:'100%', maxWidth:'420px', maxHeight:'85vh', overflowY:'auto', boxSizing:'border-box', fontFamily:'system-ui, sans-serif'}}
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          style={{position:'absolute', top:'12px', right:'12px', background:'none', border:'none', cursor:'pointer', fontSize:'22px', lineHeight:1, color:'#999', padding:'4px'}}
        >
          ×
        </button>

        <div style={{textAlign:'center'}}>
          {song.cover_url
            ? <img src={song.cover_url} width={160} height={160} style={{width:'160px', height:'160px', borderRadius:'14px', objectFit:'cover', marginBottom:'16px'}} referrerPolicy="no-referrer" alt="" />
            : <div style={{width:'160px', height:'160px', borderRadius:'14px', backgroundColor:'#f0f0f0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'48px', margin:'0 auto 16px'}}>🎵</div>
          }
          <h2 style={{fontSize:'22px', fontWeight:'500', letterSpacing:'-0.3px', color:'#111', margin:'0 0 4px'}}>{song.title}</h2>
          <p style={{fontSize:'15px', color:'#666', margin:0}}>{song.artist}</p>
          {song.created_at && <p style={{fontSize:'13px', color:'#999', margin:'8px 0 0'}}>Ajouté le {fmtDate(song.created_at)}</p>}
        </div>

        <div style={{marginTop:'20px', borderTop:'1px solid #f0f0f0', paddingTop:'16px'}}>
          {loading && !trackInfo ? (
            <p style={{fontSize:'13px', color:'#bbb', textAlign:'center', margin:0, fontStyle:'italic'}}>Chargement des infos…</p>
          ) : hasFacts ? (
            <div style={{display:'flex', flexDirection:'column', gap:'6px'}}>
              {meta && <p style={{fontSize:'13px', color:'#888', margin:0}}>{meta}</p>}
              {trackInfo?.origin && <p style={{fontSize:'13px', color:'#555', margin:0}}>Origine : {trackInfo.origin}</p>}
              {trackInfo?.yearsActive && <p style={{fontSize:'13px', color:'#555', margin:0}}>Actif : {trackInfo.yearsActive}</p>}
              {hasMembers && <p style={{fontSize:'13px', color:'#555', margin:0}}>Membres : {trackInfo.members.join(', ')}</p>}
            </div>
          ) : (
            <p style={{fontSize:'13px', color:'#bbb', textAlign:'center', margin:0}}>Pas d'infos supplémentaires.</p>
          )}
        </div>
      </div>
    </div>
  )
}
