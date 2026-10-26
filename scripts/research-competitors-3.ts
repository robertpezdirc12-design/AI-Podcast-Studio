/* Raziskava konkurence — 2. krog: video/audiogram, resume, statistika, izvozi, glasba */
import ZAI from 'z-ai-web-dev-sdk'

const QUERIES: [string, string][] = [
  ['AUDIOGRAM', 'podcast audiogram video exporter waveform cover image MP4 Headliner Wavve'],
  ['AUDIOGRAM', 'ffmpeg generate podcast video waveform overlay static image audio'],
  ['POCKETCASTS', 'Pocket Casts Speed Boost trim silence dynamic speed how it works'],
  ['RESUME', 'podcast app continue listening resume playback position sync UX'],
  ['ANALYTICS', 'Jellypod podcast analytics play counts completion rate listener stats'],
  ['ANALYTICS', 'Spotify for Podcasters episode stats plays completion what creators see'],
  ['CHAPTERS', 'YouTube podcast chapters timestamps description format requirements'],
  ['CHAPTERS', 'podcast chapter markers export formats MP4 chapters podcasting 2.0'],
  ['MUSIC', 'music bed under voice podcast ducking background ambient loop Wondercraft'],
  ['SHARE', 'Snipd highlight share clip card image podcast quotes social'],
  ['JELLYPOD', 'Jellypod hosted episode page embed player share public link'],
  ['TRENDS', 'AI podcast generator new features 2025 video export clips social'],
  ['PIPER', 'Piper TTS voice tuning length_scale noise_scale variability quality tips'],
  ['PLAYER', 'podcast web player best features transcript chapters speed sleep timer'],
]

async function main() {
  const zai = await ZAI.create()
  const seen = new Set<string>()
  for (const [tag, query] of QUERIES) {
    try {
      const res = (await zai.functions.invoke('web_search', { query, num: 8 })) as {
        url: string
        name: string
        snippet: string
        host_name: string
      }[]
      console.log(`\n=== [${tag}] ${query} ===`)
      for (const item of res ?? []) {
        if (seen.has(item.url)) continue
        seen.add(item.url)
        console.log(`- ${item.name}`)
        console.log(`  URL: ${item.url}`)
        console.log(`  ${String(item.snippet ?? '').replace(/\s+/g, ' ').slice(0, 280)}`)
      }
    } catch (err) {
      console.log(`\n=== [${tag}] ${query} === FAILED: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
