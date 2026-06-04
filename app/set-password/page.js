'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function SetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // session active, on peut changer le mot de passe
      }
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères.'); return }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError('Une erreur est survenue. Réessaie.'); setLoading(false); return }
    setDone(true)
    setTimeout(() => router.push('/login'), 2000)
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

          {done ? (
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:'48px', marginBottom:'24px'}}>✅</div>
              <h2 style={{fontSize:'24px', fontWeight:'500', color:'#111', marginBottom:'8px'}}>Mot de passe mis à jour !</h2>
              <p style={{fontSize:'14px', color:'#666'}}>Redirection vers la connexion...</p>
            </div>
          ) : (
            <>
              <h1 style={{fontSize:'28px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111', marginBottom:'8px'}}>Nouveau mot de passe</h1>
              <p style={{fontSize:'14px', color:'#666', marginBottom:'32px'}}>Choisis un nouveau mot de passe pour ton compte.</p>
              <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                <input type="password" placeholder="Nouveau mot de passe" value={password} onChange={e => setPassword(e.target.value)} required
                  style={{width:'100%', padding:'12px 16px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'14px', outline:'none', color:'#111', boxSizing:'border-box'}} />
                <input type="password" placeholder="Confirmer le mot de passe" value={confirm} onChange={e => setConfirm(e.target.value)} required
                  style={{width:'100%', padding:'12px 16px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'14px', outline:'none', color:'#111', boxSizing:'border-box'}} />
                {error && <p style={{fontSize:'13px', color:'#ef4444'}}>{error}</p>}
                <button type="submit" disabled={loading}
                  style={{width:'100%', padding:'12px', backgroundColor:'#111', color:'#fff', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'500', cursor:'pointer'}}>
                  {loading ? 'Mise à jour...' : 'Mettre à jour →'}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </main>
  )
}
