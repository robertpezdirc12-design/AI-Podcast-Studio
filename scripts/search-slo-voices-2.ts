/* Raziskava 2: uradni Piper seznam + iskanje slovenskega ženskega glasu */
import ZAI from 'z-ai-web-dev-sdk'

async function main() {
  const zai = await ZAI.create()

  // 1) Uradni VOICES.md — dokončen seznam
  try {
    const page = await zai.functions.invoke('page_reader', {
      url: 'https://github.com/rhasspy/piper/blob/master/VOICES.md',
    })
    const html = String(page?.data?.html ?? '')
    // izlušči slovenski odsek
    const idx = html.toLowerCase().indexOf('sloven')
    if (idx >= 0) {
      const chunk = html
        .slice(idx - 200, idx + 3000)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
      console.log('=== VOICES.md (slovenski del) ===')
      console.log(chunk)
    } else {
      console.log('VOICES.md: "sloven" ni najden, dolžina html:', html.length)
    }
  } catch (err) {
    console.log('page_reader VOICES.md FAILED:', err instanceof Error ? err.message : String(err))
  }

  // 2) Iskanje dodatnih slovenskih glasov
  const QUERIES = [
    'huggingface slovenian TTS model sl_SI voice vits',
    'mms-tts-slv facebook Slovenian TTS',
    'slovenski ženski glas TTS model odprta koda',
    'piper voice slovenian female sl_SI huggingface model download',
  ]
  const seen = new Set<string>()
  for (const query of QUERIES) {
    try {
      const res = (await zai.functions.invoke('web_search', { query, num: 6 })) as {
        url: string
        name: string
        snippet: string
      }[]
      console.log(`\n=== ${query} ===`)
      for (const item of res ?? []) {
        if (seen.has(item.url)) continue
        seen.add(item.url)
        console.log(`- ${item.name}`)
        console.log(`  URL: ${item.url}`)
        console.log(`  ${String(item.snippet ?? '').replace(/\s+/g, ' ').slice(0, 260)}`)
      }
    } catch (err) {
      console.log(`=== ${query} === FAILED:`, err instanceof Error ? err.message : String(err))
    }
  }
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
