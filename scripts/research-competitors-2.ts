/* Raziskava konkurence 2. del: hitrejša, manj poizvedb */
import ZAI from 'z-ai-web-dev-sdk'

const QUERIES: [string, string][] = [
  ['WONDERCRAFT', 'Wondercraft features music ads timeline editor podcast'],
  ['JELLYPOD', 'Jellypod features RSS publishing cover art show notes'],
  ['PLAYER', 'podcast player playback speed skip seconds keyboard shortcuts features'],
  ['PLAYER', 'AI podcast player waveform chapters speed control download'],
  ['EXPORT', 'podcast MP3 export intro outro music jingle chapters metadata'],
]

async function main() {
  const zai = await ZAI.create()
  const seen = new Set<string>()
  for (const [tag, query] of QUERIES) {
    const t = setTimeout(() => {}, 1000)
    clearTimeout(t)
    try {
      const res = (await Promise.race([
        zai.functions.invoke('web_search', { query, num: 6 }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 25000)),
      ])) as { url: string; name: string; snippet: string }[]
      console.log(`\n=== [${tag}] ${query} ===`)
      for (const item of res ?? []) {
        if (seen.has(item.url)) continue
        seen.add(item.url)
        console.log(`- ${item.name}`)
        console.log(`  ${String(item.snippet ?? '').replace(/\s+/g, ' ').slice(0, 260)}`)
      }
    } catch (err) {
      console.log(`\n=== [${tag}] FAILED: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
