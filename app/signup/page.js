'use client'
import { useState } from 'react'
import { createClient } from '../../lib/supabase'
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

export default function Signup() {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [avatarId, setAvatarId] = useState('avatar_1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSignup(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères.'); return }
    setLoading(true)
    const supabase = createClient()

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: 'https://obladi.live/auth/callback' }
    })

    if (signupError) { setError(signupError.message); setLoading(false); return }

    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        pseudo,
        avatar_id: avatarId,
      }, { onConflict: 'id' })

      await supabase.auth.signInWithPassword({ email, password })
      router.push('/dashboard')
    }

    setLoading(false)
  }

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#ffffff', fontFamily:'system-ui, sans-serif', display:'flex', flexDirection:'column'}}>
      <style>{`
        @media (max-width: 768px) {
          .auth-nav { padding: 16px !important; }
          .auth-container { padding: 24px !important; }
        }
      `}</style>
      <nav className="auth-nav" style={{display:'flex', alignItems:'center', padding:'24px 48px', borderBottom:'1px solid #f0f0f0'}}>
        <a href="/" style={{display:'flex', alignItems:'baseline', gap:'2px', textDecoration:'none'}}>
          <span style={{fontSize:'22px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>obladi</span>
          <span style={{fontSize:'22px', fontWeight:'500', color:'#3b82f6'}}>.</span>
          <span style={{fontSize:'13px', color:'#999'}}>app</span>
        </a>
      </nav>

      <div className="auth-container" style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'48px'}}>
        <div style={{width:'100%', maxWidth:'400px'}}>

          {step === 1 && (
            <>
              <p style={{fontSize:'12px', color:'#999', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.08em'}}>Étape 1 sur 2</p>
              <h1 style={{fontSize:'28px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111', marginBottom:'8px'}}>Choisis ton pseudo</h1>
              <p style={{fontSize:'14px', color:'#666', marginBottom:'32px'}}>C'est comme ça que les autres joueurs te verront.</p>

              <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                <input type="text" placeholder="Ton pseudo" value={pseudo} onChange={e => setPseudo(e.target.value)} maxLength={20}
                  style={{width:'100%', padding:'12px 16px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'16px', outline:'none', color:'#111', boxSizing:'border-box'}} />

                <p style={{fontSize:'13px', color:'#999', margin:'4px 0'}}>Choisis ton avatar :</p>
                <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'8px', marginBottom:'8px'}}>
                  {AVATARS.map(a => (
                    <button key={a.id} onClick={() => setAvatarId(a.id)}
                      style={{padding:'16px', fontSize:'24px', borderRadius:'8px', cursor:'pointer', border: avatarId === a.id ? '2px solid #111' : '1px solid #e0e0e0', backgroundColor: avatarId === a.id ? '#f8f8f8' : '#fff'}}>
                      {a.emoji}
                    </button>
                  ))}
                </div>

                <button onClick={() => pseudo.trim().length > 2 && setStep(2)}
                  style={{width:'100%', padding:'12px', backgroundColor: pseudo.trim().length > 2 ? '#111' : '#ccc', color:'#fff', border:'none', borderRadius:'8px', fontSize:'16px', fontWeight:'500', cursor: pseudo.trim().length > 2 ? 'pointer' : 'default', boxSizing:'border-box'}}>
                  Continuer →
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p style={{fontSize:'12px', color:'#999', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.08em'}}>Étape 2 sur 2</p>
              <h1 style={{fontSize:'28px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111', marginBottom:'8px'}}>Crée ton compte</h1>
              <p style={{fontSize:'14px', color:'#666', marginBottom:'24px'}}>Email et mot de passe pour te connecter.</p>

              <div style={{display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px', backgroundColor:'#f8f8f8', borderRadius:'8px', marginBottom:'24px'}}>
                <span style={{fontSize:'28px'}}>{AVATARS.find(a => a.id === avatarId)?.emoji}</span>
                <div>
                  <p style={{fontSize:'14px', fontWeight:'500', color:'#111'}}>{pseudo}</p>
                  <p style={{fontSize:'12px', color:'#999'}}>Ton profil</p>
                </div>
                <button onClick={() => setStep(1)} style={{marginLeft:'auto', fontSize:'12px', color:'#666', background:'none', border:'none', cursor:'pointer', textDecoration:'underline'}}>Modifier</button>
              </div>

              <form onSubmit={handleSignup} style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                <input type="email" placeholder="ton@email.com" value={email} onChange={e => setEmail(e.target.value)} required
                  style={{width:'100%', padding:'12px 16px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'16px', outline:'none', color:'#111', boxSizing:'border-box'}} />
                <input type="password" placeholder="Mot de passe (6 caractères min)" value={password} onChange={e => setPassword(e.target.value)} required
                  style={{width:'100%', padding:'12px 16px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'16px', outline:'none', color:'#111', boxSizing:'border-box'}} />
                {error && <p style={{fontSize:'13px', color:'#ef4444'}}>{error}</p>}
                <button type="submit" disabled={loading}
                  style={{width:'100%', padding:'12px', backgroundColor:'#111', color:'#fff', border:'none', borderRadius:'8px', fontSize:'16px', fontWeight:'500', cursor:'pointer', boxSizing:'border-box'}}>
                  {loading ? 'Création...' : 'Créer mon compte →'}
                </button>
              </form>

              <p style={{fontSize:'13px', color:'#999', marginTop:'24px', textAlign:'center'}}>
                Déjà un compte ? <a href="/login" style={{color:'#111', textDecoration:'underline'}}>Se connecter</a>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
