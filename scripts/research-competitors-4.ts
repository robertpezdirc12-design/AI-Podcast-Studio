/* Raziskava konkurence — 3. krog: izrezki za socialna omrežja in citatne kartice */
import ZAI from 'z-ai-web-dev-sdk'

const QUERIES: [string, string][] = [
  ['FORMAT', 'podcast clip vertical 9:16 vs square 1:1 audiogram best size TikTok Reels Shorts'],
  ['FORMAT', 'Headliner audiogram export sizes square vertical landscape dimensions'],
  ['CLIPS', 'AI podcast clip generator captions waveform best performing social 2025'],
  ['CLIPS', 'podcast share specific moment clip feature app Pocket Casts Snipd'],
  ['CARD', 'Snipd highlight card share image quote podcast feature'],
  ['CARD', 'quote card image generator podcast social share best practices design'],
  ['MUSIC', 'podcast background music bed low volume under voice ducking ffmpeg amix'],
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
      }[]
      console.log(`\n=== [${tag}] ${query} ===`)
      for (const item of res ?? []) {
        if (seen.has(item.url)) continue
        seen.add(item.url)
        console.log(`- ${item.name}`)
        console.log(`  ${String(item.snippet ?? '').replace(/\s+/g, ' ').slice(0, 250)}`)
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
