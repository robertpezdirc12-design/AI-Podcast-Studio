/* Spletna raziskava: pravi slovenski TTS glasovi */
import ZAI from 'z-ai-web-dev-sdk'

const QUERIES: [string, string][] = [
  ['sl_SI', 'Piper TTS Slovenian voice sl_SI models'],
  ['sl_SI', 'Slovenian text to speech open source neural voice'],
  ['sl_SI', 'slovenski TTS glas odprtokodni nevronski'],
  ['sl_SI', 'piper-voices sl_SI huggingface slovenian'],
  ['sl_SI', 'Piper voice generator Slovenian female voice model'],
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
        const key = item.url
        if (seen.has(key)) continue
        seen.add(key)
        console.log(`- ${item.name}`)
        console.log(`  URL: ${item.url}`)
        console.log(`  ${String(item.snippet ?? '').replace(/\s+/g, ' ').slice(0, 320)}`)
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
