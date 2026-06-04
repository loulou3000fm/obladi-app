import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  console.log('Auth callback called, code:', code ? 'present' : 'missing')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {}
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    console.log('Exchange result - user:', data?.user?.email, 'error:', error?.message)

    if (error) {
      console.log('Auth error:', error)
      return NextResponse.redirect(`${origin}/login?error=auth`)
    }

    const user = data?.user
    if (user) {
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      console.log('Existing profile:', existingProfile, 'error:', profileError?.message)

      if (!existingProfile) {
        const { error: insertError } = await supabase.from('profiles').insert({
          id: user.id,
          pseudo: user.email.split('@')[0],
          avatar_id: 'avatar_1',
        })
        console.log('Profile insert error:', insertError?.message)
        return NextResponse.redirect(`${origin}/set-password`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
