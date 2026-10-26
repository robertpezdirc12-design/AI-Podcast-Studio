/* Raziskava konkurence — 4. krog: iskanje po transkriptu, timeline/valovna oblika, bližnjice, dostopnost */
import ZAI from 'z-ai-web-dev-sdk'

const QUERIES: [string, string][] = [
  ['SEARCH', 'podcast app search inside episode transcript jump to moment feature'],
  ['SEARCH', 'Descript search transcript find word jump to audio timestamp UX'],
  ['TIMELINE', 'podcast player segmented progress bar chapters waveform visualization web'],
  ['TIMELINE', 'Pocket Casts web player waveform chapters click to seek'],
  ['SHORTCUTS', 'podcast app keyboard shortcuts help overlay question mark YouTube style'],
  ['BOOST', 'Pocket Casts volume boost how it works Web Audio gain'],
  ['ACCESS', 'podcast web player accessibility WCAG screen reader transcript'],
  ['TRENDS', 'AI podcast studio features roadmap 2025 what users want most'],
  ['NOTEBOOKLM', 'NotebookLM audio overview interactive mode join the conversation beta'],
  ['GENFM', 'ElevenLabs GenFM features multi-host languages 2025'],
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
      console.error(`[${tag}] napaka:`, err instanceof Error ? err.message : err)
    }
  }
}

void main()
