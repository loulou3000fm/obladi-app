'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function SetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setReady(true)
    }
    check()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères.'); return }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
  }

  if (!ready) return (
    <main style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui'}}>
      <p style={{color:'#999', fontSize:'14px'}}>Chargement...</p>
    </main>
  )

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#ffffff', fontFamily:'system-ui, sans-serif', display:'flex', flexDirection:'column'}}>
      <nav style={{display:'flex', alignItems:'center', padding:'24px 48px', borderBottom:'1px solid #f0f0f0'}}>
        <a href="/" style={{display:'flex', alignItems:'baseline', gap:'2px', textDecoration:'none'}}>
          <span style={{fontSize:'22px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>obladi</span>
          <span style={{fontSize:'22px', fontWeight:'500', color:'#3b82f6'}}>.</span>
          <span style={{fontSize:'13px', color:'#999'}}>app</span>
        </a>
      </nav>
      <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'48px'}}>
        <div style={{width:'100%', maxWidth:'400px'}}>
          <h1 style={{fontSize:'28px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111', marginBottom:'8px'}}>Définis ton mot de passe</h1>
          <p style={{fontSize:'14px', color:'#666', marginBottom:'32px', lineHeight:'1.6'}}>Tu pourras l'utiliser pour te connecter directement la prochaine fois.</p>
          <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:'12px'}}>
            <input
              type="password"
              placeholder="Mot de passe (6 caractères min)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{width:'100%', padding:'12px 16px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'14px', outline:'none', color:'#111', boxSizing:'border-box'}}
            />
            <input
              type="password"
              placeholder="Confirme le mot de passe"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              style={{width:'100%', padding:'12px 16px', border:'1px solid #e0e0e0', borderRadius:'8px', fontSize:'14px', outline:'none', color:'#111', boxSizing:'border-box'}}
            />
            {error && <p style={{fontSize:'13px', color:'#ef4444'}}>{error}</p>}
            <button type="submit" disabled={loading}
              style={{width:'100%', padding:'12px', backgroundColor:'#111', color:'#fff', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'500', cursor:'pointer'}}>
              {loading ? 'Enregistrement...' : 'Définir mon mot de passe →'}
            </button>
          </form>
          <p style={{fontSize:'13px', color:'#999', marginTop:'16px', textAlign:'center'}}>
            <a href="/dashboard" style={{color:'#666', textDecoration:'underline'}}>Passer cette étape</a>
          </p>
        </div>
      </div>
    </main>
  )
}
