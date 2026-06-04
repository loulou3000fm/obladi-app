'use client'
import { useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const router = useRouter()

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Email ou mot de passe incorrect.'); setLoading(false); return }
    router.push('/dashboard')
  }

  async function handleReset(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://obladi.live/set-password'
    })
    setResetSent(true)
    setLoading(false)
  }

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#ffffff', fontFamily:'system-ui, sans-serif', display:'flex', flexDirection:'column'}}>
      <nav style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'24px 48px', borderBottom:'1px solid #f0f0f0'}}>
        <a href="/" style={{display:'flex', alignItems:'baseline', gap:'2px', textDecoration:'none'}}>
          <span style={{fontSize:'22px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>obladi</span>
          <span style={{fontSize:'22px', fontWeight:'500', color:'#3b82f6'}}>.</span>
          <span style={{fontSize:'13px', color:'#999'}}>app</span>
        </a>
      </nav>

      <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'48px'}}>
        <div style={{width:'100%', maxWidth:'400px'}}>

          {mode === 'login' && (
            <>
              <h1 style={{fontSize:'28px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111', marginBottom:'8px'}}>Connexion</h1>
              <p style={{fontSize:'14px', color:'#666', marginBottom:'32px'}}>Connecte-toi avec ton email et mot de passe.</p>
              <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                <input type="email" placeholder="ton@email.com" value={email} onChange={e => setEmail(e.target.value)} required
                  style={{width:'100%', padding:'12px 16px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'14px', outline:'none', color:'#111', boxSizing:'border-box'}} />
                <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} required
                  style={{width:'100%', padding:'12px 16px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'14px', outline:'none', color:'#111', boxSizing:'border-box'}} />
                {error && <p style={{fontSize:'13px', color:'#ef4444'}}>{error}</p>}
                <button type="submit" disabled={loading}
                  style={{width:'100%', padding:'12px', backgroundColor:'#111', color:'#fff', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'500', cursor:'pointer'}}>
                  {loading ? 'Connexion...' : 'Se connecter →'}
                </button>
              </form>
              <div style={{marginTop:'20px', textAlign:'center', display:'flex', flexDirection:'column', gap:'8px'}}>
                <button onClick={() => { setMode('reset'); setError('') }}
                  style={{background:'none', border:'none', cursor:'pointer', fontSize:'13px', color:'#666', textDecoration:'underline'}}>
                  Mot de passe oublié ?
                </button>
                <a href="/signup" style={{fontSize:'13px', color:'#999', textDecoration:'none'}}>
                  Pas encore de compte ? <span style={{color:'#111', textDecoration:'underline'}}>Créer un compte</span>
                </a>
              </div>
            </>
          )}

          {mode === 'reset' && (
            <>
              {resetSent ? (
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:'48px', marginBottom:'24px'}}>📬</div>
                  <h2 style={{fontSize:'24px', fontWeight:'500', color:'#111', marginBottom:'8px'}}>Vérifie ta boîte mail</h2>
                  <p style={{fontSize:'14px', color:'#666', lineHeight:'1.6', marginBottom:'24px'}}>
                    On a envoyé un lien à <strong>{email}</strong> pour réinitialiser ton mot de passe.
                  </p>
                  <button onClick={() => { setMode('login'); setResetSent(false) }}
                    style={{fontSize:'13px', color:'#666', background:'none', border:'none', cursor:'pointer', textDecoration:'underline'}}>
                    Retour à la connexion
                  </button>
                </div>
              ) : (
                <>
                  <h1 style={{fontSize:'28px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111', marginBottom:'8px'}}>Mot de passe oublié</h1>
                  <p style={{fontSize:'14px', color:'#666', marginBottom:'32px'}}>Entre ton email et on t'envoie un lien pour le réinitialiser.</p>
                  <form onSubmit={handleReset} style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                    <input type="email" placeholder="ton@email.com" value={email} onChange={e => setEmail(e.target.value)} required
                      style={{width:'100%', padding:'12px 16px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'14px', outline:'none', color:'#111', boxSizing:'border-box'}} />
                    {error && <p style={{fontSize:'13px', color:'#ef4444'}}>{error}</p>}
                    <button type="submit" disabled={loading}
                      style={{width:'100%', padding:'12px', backgroundColor:'#111', color:'#fff', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'500', cursor:'pointer'}}>
                      {loading ? 'Envoi...' : 'Envoyer le lien →'}
                    </button>
                  </form>
                  <div style={{marginTop:'16px', textAlign:'center'}}>
                    <button onClick={() => { setMode('login'); setError('') }}
                      style={{fontSize:'13px', color:'#666', background:'none', border:'none', cursor:'pointer', textDecoration:'underline'}}>
                      Retour à la connexion
                    </button>
                  </div>
                </>
              )}
            </>
          )}

        </div>
      </div>
    </main>
  )
}
