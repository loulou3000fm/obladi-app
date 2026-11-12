// Filet de sécurité : garantit qu'un utilisateur connecté a une ligne dans `profiles`.
// Sans profil, le joueur ne peut pas rejoindre une room (room_players → profiles) et reste invisible.
// Le pseudo/avatar choisis à l'inscription sont stockés dans user_metadata ; à défaut, préfixe de l'email.
export async function ensureProfile(supabase, user) {
  if (!user) return null
  const { data: existing } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (existing) return existing
  const meta = user.user_metadata || {}
  const { data: created, error } = await supabase.from('profiles').insert({
    id: user.id,
    pseudo: meta.pseudo || (user.email || 'joueur').split('@')[0],
    avatar_id: meta.avatar_id || 'avatar_1',
  }).select().single()
  if (error) { console.error('ensureProfile:', error.message); return null }
  return created
}
