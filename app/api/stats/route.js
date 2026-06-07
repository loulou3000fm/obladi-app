import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const [answersRes, songsRes, profilesRes, roomsRes, roomPlayersRes] = await Promise.all([
      supabase.from('answers').select('song_id, player_id, room_id, points, artist_correct, title_correct'),
      supabase.from('songs').select('id, title, artist, playlist_id, created_at'),
      supabase.from('profiles').select('id, pseudo, avatar_id'),
      supabase.from('rooms').select('id, title, code, created_at, playlist_id, playlists(name)').eq('status', 'finished').order('created_at', { ascending: false }),
      supabase.from('room_players').select('room_id, player_id, score'),
    ])

    for (const r of [answersRes, songsRes, profilesRes, roomsRes, roomPlayersRes]) {
      if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 })
    }

    const answers = answersRes.data || []
    const songs = songsRes.data || []
    const profiles = profilesRes.data || []
    const rooms = roomsRes.data || []
    const roomPlayers = roomPlayersRes.data || []

    const songMap = new Map(songs.map(s => [s.id, s]))
    const profileMap = new Map(profiles.map(p => [p.id, p]))

    // --- Section 1 : stats globales ---

    // Comptage des chansons trouvées (artiste + titre corrects)
    const foundCounts = new Map()
    for (const a of answers) {
      if (a.artist_correct && a.title_correct) {
        foundCounts.set(a.song_id, (foundCounts.get(a.song_id) || 0) + 1)
      }
    }

    // On considère toutes les chansons qui ont au moins une réponse (donc jouées)
    const playedSongs = new Set(answers.map(a => a.song_id))
    const songStats = [...playedSongs]
      .filter(id => songMap.has(id))
      .map(song_id => {
        const s = songMap.get(song_id)
        return { song_id, count: foundCounts.get(song_id) || 0, title: s.title, artist: s.artist }
      })

    const topFound = [...songStats].sort((a, b) => b.count - a.count).slice(0, 5)
    const leastFound = [...songStats].sort((a, b) => a.count - b.count).slice(0, 5)

    // Meilleurs joueurs toutes parties confondues
    const playerPoints = new Map()
    for (const a of answers) {
      playerPoints.set(a.player_id, (playerPoints.get(a.player_id) || 0) + (a.points || 0))
    }
    const topPlayers = [...playerPoints.entries()]
      .map(([player_id, points]) => {
        const p = profileMap.get(player_id)
        return { player_id, points, pseudo: p?.pseudo || 'Inconnu', avatar_id: p?.avatar_id || null }
      })
      .sort((a, b) => b.points - a.points)
      .slice(0, 5)

    // --- Section 2 : stats par partie ---
    const games = rooms.map(room => {
      const rp = roomPlayers.filter(p => p.room_id === room.id)
      const totalPlayers = rp.length

      const ranking = rp
        .map(p => {
          const prof = profileMap.get(p.player_id)
          return { player_id: p.player_id, score: p.score || 0, pseudo: prof?.pseudo || 'Inconnu', avatar_id: prof?.avatar_id || null }
        })
        .sort((a, b) => b.score - a.score)

      const roomAnswers = answers.filter(a => a.room_id === room.id)
      const playlistSongs = songs
        .filter(s => s.playlist_id === room.playlist_id)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

      const songsDetail = playlistSongs.map(s => {
        const found = roomAnswers.filter(a => a.song_id === s.id && a.artist_correct && a.title_correct).length
        return {
          song_id: s.id,
          title: s.title,
          artist: s.artist,
          found,
          total: totalPlayers,
          rate: totalPlayers ? Math.round((found / totalPlayers) * 100) : 0,
        }
      })

      return {
        id: room.id,
        title: room.title || room.playlists?.name || 'Partie',
        code: room.code,
        date: room.created_at,
        playerCount: totalPlayers,
        ranking,
        songs: songsDetail,
      }
    })

    return NextResponse.json({ topFound, leastFound, topPlayers, games })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
