'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthConfirm() {
  const [status, setStatus] = useState('Connexion en cours...')
  const router = useRouter()

  useEffect(() => {
    async function handleHash() {
      const hash = window.location.hash
      if (!hash) { setStatus('Lien invalide.'); return }

      const params = new URLSearchParams(hash.replace('#', ''))
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')

      if (!access_token || !refresh_token) {
        setStatus('Token manquant dans le lien.')
        return
      }

      const supabase = createClient()
      const { error } = await supabase.auth.setSession({ access_token, refresh_token })

      if (error) {
        setStatus('Erreur de connexion. Réessaie.')
        return
      }

      router.push('/dashboard')
    }

    handleHash()
  }, [])

  return (
    <main style={{minHeight:'100vh', backgroundColor:'#ffffff', fontFamily:'system-ui, sans-serif', display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{textAlign:'center', maxWidth:'400px', padding:'48px'}}>
        <div style={{fontSize:'48px', marginBottom:'24px'}}>🎵</div>
        <p style={{fontSize:'16px', color:'#666'}}>{status}</p>
      </div>
    </main>
  )
}
