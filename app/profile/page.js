'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { getLevel } from '../../lib/game'
import { useRouter } from 'next/navigation'

const AVATARS = [
  { id: 'avatar_1', emoji: '🎵' },
  { id: 'avatar_2', emoji: '🎸' },
  { id: 'avatar_3', emoji: '🎹' },
  { id: 'avatar_4', emoji: '🥁' },
  { id: 'avatar_5', emoji: '🎺' },
  { id: 'avatar_6', emoji: '🎻' },
  { id: 'avatar_7', emoji: '🎤' },
  { id: 'avatar_8', emoji: '🎧' },
]

const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000

export default function Profile() {
  const router = useRouter()
  const [userId, setUserId] = useState(null)
  const [profile, setProfile] = useState(null)
  const [pseudo, setPseudo] = useState('')
  const [bio, setBio] = useState('')
  const [avatarId, setAvatarId] = useState('avatar_1')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)
      setPseudo(prof?.pseudo || '')
      setBio(prof?.bio || '')
      setAvatarId(prof?.avatar_id || 'avatar_1')
      setLoading(false)
    }
    load()
  }, [])

  async function selectAvatar(aid) {
    setAvatarId(aid)
    const supabase = createClient()
    await supabase.from('profiles').update({ avatar_id: aid }).eq('id', userId)
    setProfile(prev => ({ ...prev, avatar_id: aid }))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const update = { bio }
    if (canChangePseudo && pseudo.trim().length > 2 && pseudo.trim() !== profile.pseudo) {
      update.pseudo = pseudo.trim()
      update.pseudo_updated_at = new Date().toISOString()
    }
    await supabase.from('profiles').update(update).eq('id', userId)
    setProfile(prev => ({ ...prev, ...update }))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  if (loading) return (
    <main style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui'}}>
      <p style={{color:'#999', fontSize:'14px'}}>Chargement...</p>
    </main>
  )

  const canChangePseudo = !profile?.pseudo_updated_at || (Date.now() - new Date(profile.pseudo_updated_at).getTime()) > TWO_WEEKS
  const nextChange = profile?.pseudo_updated_at ? new Date(new Date(profile.pseudo_updated_at).getTime() + TWO_WEEKS) : null
  const lvl = getLevel(profile?.total_score || 0)

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#fff', fontFamily:'system-ui, sans-serif'}}>
      <style>{`
        @media (max-width: 768px) {
          .prof-nav { padding: 16px 24px !important; }
          .prof-container { padding: 24px 16px !important; }
          .prof-stats { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      <nav className="prof-nav" style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'24px 48px', borderBottom:'1px solid #f0f0f0'}}>
        <button onClick={() => router.push('/dashboard')} style={{background:'none', border:'none', cursor:'pointer', fontSize:'14px', color:'#666'}}>← Retour</button>
        <div style={{display:'flex', alignItems:'baseline', gap:'2px'}}>
          <span style={{fontSize:'18px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>obladi</span>
          <span style={{fontSize:'18px', fontWeight:'500', color:'#3b82f6'}}>.</span>
        </div>
      </nav>

      <div className="prof-container" style={{maxWidth:'600px', margin:'0 auto', padding:'48px'}}>
        <h1 style={{fontSize:'28px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111', marginBottom:'32px'}}>Mon profil</h1>

        {/* Avatar */}
        <div style={{marginBottom:'32px'}}>
          <label style={{fontSize:'13px', fontWeight:'500', color:'#111', display:'block', marginBottom:'12px'}}>Avatar</label>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'8px'}}>
            {AVATARS.map(a => (
              <button key={a.id} onClick={() => selectAvatar(a.id)}
                style={{padding:'16px', fontSize:'24px', borderRadius:'8px', cursor:'pointer', border: avatarId === a.id ? '2px solid #111' : '1px solid #e0e0e0', backgroundColor: avatarId === a.id ? '#f8f8f8' : '#fff'}}>
                {a.emoji}
              </button>
            ))}
          </div>
          <p style={{fontSize:'12px', color:'#999', marginTop:'8px'}}>Sauvegarde immédiate au clic.</p>
        </div>

        {/* Pseudo */}
        <div style={{marginBottom:'32px'}}>
          <label style={{fontSize:'13px', fontWeight:'500', color:'#111', display:'block', marginBottom:'8px'}}>Pseudo</label>
          {canChangePseudo ? (
            <>
              <input
                value={pseudo}
                onChange={e => setPseudo(e.target.value)}
                maxLength={20}
                placeholder="Ton pseudo"
                style={{width:'100%', padding:'12px 16px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'16px', outline:'none', color:'#111', boxSizing:'border-box'}}
              />
              <p style={{fontSize:'12px', color:'#999', marginTop:'6px'}}>1 modification possible toutes les 2 semaines.</p>
            </>
          ) : (
            <>
              <input
                value={profile.pseudo}
                readOnly
                style={{width:'100%', padding:'12px 16px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'16px', outline:'none', color:'#999', boxSizing:'border-box', backgroundColor:'#f8f8f8'}}
              />
              <p style={{fontSize:'12px', color:'#999', marginTop:'6px'}}>Prochain changement possible le {formatDate(nextChange)}</p>
            </>
          )}
        </div>

        {/* Bio */}
        <div style={{marginBottom:'32px'}}>
          <label style={{fontSize:'13px', fontWeight:'500', color:'#111', display:'block', marginBottom:'8px'}}>Bio</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value.slice(0, 200))}
            maxLength={200}
            rows={3}
            placeholder="Quelques mots sur toi..."
            style={{width:'100%', padding:'12px 16px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'16px', outline:'none', color:'#111', boxSizing:'border-box', resize:'vertical', fontFamily:'inherit'}}
          />
          <p style={{fontSize:'12px', color:'#999', marginTop:'6px', textAlign:'right'}}>{bio.length}/200</p>
        </div>

        {/* Bouton enregistrer */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{width:'100%', padding:'14px', backgroundColor: saved ? '#16a34a' : '#111', color:'#fff', border:'none', borderRadius:'8px', fontSize:'15px', fontWeight:'500', cursor:'pointer', marginBottom:'48px', boxSizing:'border-box'}}
        >
          {saving ? 'Enregistrement...' : saved ? '✓ Enregistré' : 'Enregistrer les modifications'}
        </button>

        {/* Stats */}
        <h2 style={{fontSize:'18px', fontWeight:'500', color:'#111', marginBottom:'16px', letterSpacing:'-0.3px'}}>Statistiques</h2>
        <div className="prof-stats" style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'12px'}}>
          <div style={{padding:'20px 16px', backgroundColor:'#f8f8f8', borderRadius:'12px', textAlign:'center'}}>
            <p style={{fontSize:'22px', fontWeight:'500', color:'#111'}}>{profile?.games_played || 0}</p>
            <p style={{fontSize:'12px', color:'#999'}}>Parties</p>
          </div>
          <div style={{padding:'20px 16px', backgroundColor:'#f8f8f8', borderRadius:'12px', textAlign:'center'}}>
            <p style={{fontSize:'22px', fontWeight:'500', color:'#111'}}>{profile?.best_score || 0}</p>
            <p style={{fontSize:'12px', color:'#999'}}>Meilleur score</p>
          </div>
          <div style={{padding:'20px 16px', backgroundColor:'#f8f8f8', borderRadius:'12px', textAlign:'center'}}>
            <p style={{fontSize:'22px', fontWeight:'500', color:'#111'}}>{profile?.total_score || 0}</p>
            <p style={{fontSize:'12px', color:'#999'}}>Score total</p>
          </div>
          <div style={{padding:'20px 16px', backgroundColor:'#f8f8f8', borderRadius:'12px', textAlign:'center'}}>
            <p style={{fontSize:'22px', fontWeight:'500', color:'#111'}}>{lvl.emoji}</p>
            <p style={{fontSize:'12px', color:'#999'}}>{lvl.name}</p>
          </div>
        </div>
      </div>
    </main>
  )
}
