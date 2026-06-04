'use client'
import { useParams, useRouter } from 'next/navigation'

export default function Interrupted() {
  const router = useRouter()
  return (
    <main style={{minHeight:'100vh', backgroundColor:'#fff', fontFamily:'system-ui, sans-serif', display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{textAlign:'center', maxWidth:'400px', padding:'48px'}}>
        <div style={{fontSize:'48px', marginBottom:'24px'}}>🎵</div>
        <h1 style={{fontSize:'24px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111', marginBottom:'8px'}}>Partie interrompue</h1>
        <p style={{fontSize:'14px', color:'#666', lineHeight:'1.6', marginBottom:'32px'}}>L'admin a mis fin à la partie. Pas d'inquiétude, rejoins une nouvelle room !</p>
        <button onClick={() => router.push('/dashboard')}
          style={{width:'100%', padding:'14px', backgroundColor:'#111', color:'#fff', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'500', cursor:'pointer'}}>
          Retour à mon espace
        </button>
      </div>
    </main>
  )
}
