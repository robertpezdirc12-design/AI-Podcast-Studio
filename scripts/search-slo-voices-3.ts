/* Raziskava 3: Gepard-Slovenian-TTS podrobnosti + dodatna iskanja */
import ZAI from 'z-ai-web-dev-sdk'

async function main() {
  const zai = await ZAI.create()

  try {
    const page = await zai.functions.invoke('page_reader', {
      url: 'https://huggingface.co/texdata/Gepard-Slovenian-TTS',
    })
    const text = String(page?.data?.html ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
    console.log('=== Gepard-Slovenian-TTS (model card) ===')
    console.log(text.slice(0, 4500))
  } catch (err) {
    console.log('page_reader Gepard FAILED:', err instanceof Error ? err.message : String(err))
  }

  const QUERIES = [
    'Gepard Slovenian TTS piper onnx voice',
    'site:huggingface.co slovenian TTS voice onnx piper',
    'slovenščina TTS glas ženski odprtokodni huggingface',
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
