'use client'
import { useState } from 'react'
import { createClient } from '../lib/supabase'

const inputStyle = { width: '100%', padding: '12px 16px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '16px', outline: 'none', color: '#111', boxSizing: 'border-box' }

export default function SuggestModal({ open, viewerId, onClose, onSent }) {
  const [artist, setArtist] = useState('')
  const [title, setTitle] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')

  if (!open) return null
  const valid = artist.trim() && title.trim()

  async function send() {
    if (!valid || sending || !viewerId) return
    setSending(true)
    setErr('')
    const supabase = createClient()
    const { error } = await supabase.from('suggestions').insert({ player_id: viewerId, artist: artist.trim(), title: title.trim() })
    setSending(false)
    if (error) { setErr("Échec de l'envoi. Réessaie."); return }
    setArtist('')
    setTitle('')
    onSent && onSent()
  }

  return (
    <div className="sg-overlay" onClick={onClose} style={{position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px'}}>
      <style>{`
        @keyframes sg-in { from { opacity:0; transform: translateY(14px); } to { opacity:1; transform: translateY(0); } }
        .sg-card { animation: sg-in 0.2s ease forwards; }
        @media (max-width: 768px) {
          .sg-overlay { align-items: flex-end !important; padding: 0 !important; }
          .sg-card { width: 100% !important; max-width: 100% !important; border-radius: 20px 20px 0 0 !important; }
        }
      `}</style>
      <div className="sg-card" onClick={e => e.stopPropagation()} style={{position:'relative', backgroundColor:'#fff', borderRadius:'16px', padding:'28px', width:'100%', maxWidth:'420px', boxSizing:'border-box', fontFamily:'system-ui, sans-serif'}}>
        <button onClick={onClose} aria-label="Fermer" style={{position:'absolute', top:'12px', right:'12px', background:'none', border:'none', cursor:'pointer', fontSize:'22px', lineHeight:1, color:'#999', padding:'4px'}}>×</button>
        <h2 style={{fontSize:'20px', fontWeight:'500', letterSpacing:'-0.3px', color:'#111', margin:'0 0 6px'}}>Proposer un morceau</h2>
        <p style={{fontSize:'13px', color:'#999', margin:'0 0 20px'}}>Suggère un titre à ajouter aux prochaines parties.</p>
        <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
          <input value={artist} onChange={e => setArtist(e.target.value)} placeholder="Artiste" maxLength={120} style={inputStyle} />
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre" maxLength={120} style={inputStyle} />
          {err && <p style={{fontSize:'13px', color:'#ef4444', margin:0}}>{err}</p>}
          <button onClick={send} disabled={!valid || sending} style={{width:'100%', padding:'14px', backgroundColor: (!valid || sending) ? '#ccc' : '#111', color:'#fff', border:'none', borderRadius:'8px', fontSize:'15px', fontWeight:'500', cursor: (!valid || sending) ? 'default' : 'pointer', boxSizing:'border-box'}}>
            {sending ? 'Envoi...' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  )
}
