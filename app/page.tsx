'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const supabase = createClient()

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()

      const hash = window.location.hash
      if (hash.includes('access_token')) {
        if (session) router.push('/dashboard')
        return
      }

      setIsLoggedIn(!!session)
    }
    init()
  }, [])
  return (
    <main style={{minHeight:'100vh', backgroundColor:'#ffffff', fontFamily:'system-ui, sans-serif'}}>
      <style>{`
        @media (max-width: 768px) {
          .home-nav { padding: 16px 24px !important; }
          .home-signup-btn { padding: 8px 16px !important; font-size: 13px !important; }
          .home-hero { padding: 32px 24px !important; }
          .home-hero-title { font-size: 40px !important; letter-spacing: -1px !important; }
          .home-hero-actions { flex-direction: column !important; width: 100% !important; max-width: 320px !important; margin: 0 auto !important; }
          .home-hero-actions a { width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
          .home-features { padding: 48px 24px !important; }
          .home-features-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
          .home-footer { flex-direction: column !important; text-align: center !important; gap: 12px !important; }
        }
      `}</style>

      {/* Nav */}
      <nav className="home-nav" style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'24px 48px', borderBottom:'1px solid #f0f0f0'}}>
        <div style={{display:'flex', alignItems:'baseline', gap:'2px'}}>
          <span style={{fontSize:'22px', fontWeight:'500', letterSpacing:'-0.5px', color:'#111'}}>obladi</span>
          <span style={{fontSize:'22px', fontWeight:'500', color:'#3b82f6'}}>.</span>
          <span style={{fontSize:'13px', color:'#999'}}>app</span>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
          {isLoggedIn ? (
            <>
              <a href="/dashboard" style={{fontSize:'14px', color:'#666', textDecoration:'none'}}>Mon espace</a>
              <button
                onClick={async () => {
                  const supabase = createClient()
                  await supabase.auth.signOut()
                  window.location.reload()
                }}
                style={{fontSize:'14px', backgroundColor:'#111', color:'#fff', padding:'8px 18px', borderRadius:'8px', border:'none', cursor:'pointer'}}
              >
                Se déconnecter
              </button>
            </>
          ) : (
            <>
              <a href="/login" style={{fontSize:'14px', color:'#666', textDecoration:'none'}}>Se connecter</a>
              <a href="/signup" className="home-signup-btn" style={{fontSize:'14px', backgroundColor:'#111', color:'#fff', padding:'8px 18px', borderRadius:'8px', textDecoration:'none'}}>Créer un compte</a>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="home-hero" style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'120px 48px', maxWidth:'900px', margin:'0 auto'}}>
        <div style={{display:'inline-flex', alignItems:'center', gap:'8px', backgroundColor:'#f8f8f8', border:'1px solid #e8e8e8', borderRadius:'99px', padding:'6px 16px', fontSize:'12px', color:'#666', marginBottom:'32px'}}>
          <span style={{width:'6px', height:'6px', backgroundColor:'#22c55e', borderRadius:'50%', display:'inline-block'}}></span>
          Bêta ouverte — rejoins les premiers joueurs
        </div>
        <h1 className="home-hero-title" style={{fontSize:'64px', fontWeight:'500', letterSpacing:'-2px', color:'#111', lineHeight:'1.0', marginBottom:'24px'}}>
          Le blindtest musical<br />
          <span style={{color:'#3b82f6'}}>pour les vrais.</span>
        </h1>
        <p style={{fontSize:'18px', color:'#666', marginBottom:'40px', maxWidth:'400px', lineHeight:'1.6'}}>
          Prouve que tu connais ta musique. Retrouve l'artiste et le titre avant tout le monde.
        </p>
        <div className="home-hero-actions" style={{display:'flex', alignItems:'center', gap:'12px'}}>
          <a href="/signup" style={{backgroundColor:'#111', color:'#fff', padding:'14px 32px', borderRadius:'8px', fontSize:'14px', fontWeight:'500', textDecoration:'none'}}>
            Jouer maintenant
          </a>
          <a href="/demo" style={{border:'1px solid #e0e0e0', color:'#111', padding:'14px 32px', borderRadius:'8px', fontSize:'14px', fontWeight:'500', textDecoration:'none'}}>
            Voir une démo
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="home-features" style={{padding:'80px 48px', borderTop:'1px solid #f0f0f0'}}>
        <div className="home-features-grid" style={{maxWidth:'900px', margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'48px'}}>
          <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
            <div style={{width:'40px', height:'40px', backgroundColor:'#eff6ff', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px'}}>♪</div>
            <h3 style={{fontSize:'14px', fontWeight:'500', color:'#111'}}>Blindtest en live</h3>
            <p style={{fontSize:'14px', color:'#666', lineHeight:'1.6'}}>Écoute l'extrait, tape l'artiste et le titre avant les autres joueurs.</p>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
            <div style={{width:'40px', height:'40px', backgroundColor:'#f0fdf4', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px'}}>★</div>
            <h3 style={{fontSize:'14px', fontWeight:'500', color:'#111'}}>Scoring par artiste</h3>
            <p style={{fontSize:'14px', color:'#666', lineHeight:'1.6'}}>Points séparés pour le titre et l'artiste. Bonus vitesse pour les plus rapides.</p>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
            <div style={{width:'40px', height:'40px', backgroundColor:'#faf5ff', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px'}}>◈</div>
            <h3 style={{fontSize:'14px', fontWeight:'500', color:'#111'}}>Récompenses & avatars</h3>
            <p style={{fontSize:'14px', color:'#666', lineHeight:'1.6'}}>Débloque des badges et avatars exclusifs selon tes performances.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer" style={{padding:'32px 48px', borderTop:'1px solid #f0f0f0', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <div style={{display:'flex', alignItems:'baseline', gap:'2px'}}>
          <span style={{fontSize:'14px', fontWeight:'500', color:'#111'}}>obladi</span>
          <span style={{fontSize:'14px', color:'#3b82f6'}}>.</span>
          <span style={{fontSize:'12px', color:'#999'}}>app</span>
        </div>
        <p style={{fontSize:'12px', color:'#999'}}>Le blindtest musical pour les vrais.</p>
      </footer>

    </main>
  )
}
