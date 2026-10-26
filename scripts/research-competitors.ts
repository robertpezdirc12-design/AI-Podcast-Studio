/* Raziskava konkurence: AI podcast generatorji — kaj imajo boljše in več */
import ZAI from 'z-ai-web-dev-sdk'

const QUERIES: [string, string][] = [
  ['OVERVIEW', 'best AI podcast generators 2025 comparison NotebookLM ElevenLabs Wondercraft'],
  ['OVERVIEW', 'AI podcast studio features show notes chapters cover art export RSS'],
  ['NOTEBOOKLM', 'NotebookLM audio overview features languages interactive mode deep dive'],
  ['NOTEBOOKLM', 'NotebookLM audio overview customize prompt length 2025'],
  ['ELEVENLABS', 'ElevenLabs GenFM studio podcast features multilingual voices'],
  ['WONDERCRAFT', 'Wondercraft AI podcast studio features pricing voices music'],
  ['JELLYPOD', 'Jellypod AI podcast studio features pricing RSS publishing'],
  ['DESCRIPT', 'Descript AI podcast editing features overdub studio sound'],
  ['PODCASTLE', 'Podcastle AI text to podcast features voices revoice'],
  ['FEATURES', 'AI podcast generator turn article URL into podcast episode'],
  ['FEATURES', 'AI podcast generator waveform visualization chapters markers player'],
  ['FEATURES', 'AI podcast generator multi-language support transcription search transcript'],
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
        console.log(`  ${String(item.snippet ?? '').replace(/\s+/g, ' ').slice(0, 300)}`)
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
