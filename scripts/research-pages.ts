/* Poglobljeno branje konkurenčnih strani (page_reader → data.html) */
import ZAI from 'z-ai-web-dev-sdk'

const PAGES: [string, string][] = [
  ['COMPARE', 'https://podcast-generator.ai/blog/best-ai-podcast-generator'],
  ['JELLYPOD', 'https://www.jellypod.com'],
  ['CONCH', 'https://www.getconch.ai/podcast'],
  ['WONDERCRAFT', 'https://www.wondercraft.ai/tools/ai-podcast-generator'],
  ['PODSQUEEZE', 'https://podsqueeze.com/podcast-show-notes-generator'],
]

interface PageData {
  title?: string
  html?: string
  description?: string
  httpStatus?: number
}

async function main() {
  const zai = await ZAI.create()

  for (const [tag, url] of PAGES) {
    try {
      const res = (await zai.functions.invoke('page_reader', { url })) as {
        data?: PageData
      }
      const data = res?.data ?? {}
      const clean = String(data.html ?? '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim()
      console.log(`\n########## [${tag}] ${url} (HTTP ${data.httpStatus})`)
      console.log(`TITLE: ${data.title ?? ''}`)
      console.log(clean.slice(0, 7000))
    } catch (err) {
      console.log(`\n########## [${tag}] ${url} FAILED: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
