/* Regeneracija epizod z novimi pravimi slovenskimi glasovi (artur/jakob/matjaz) */
const BASE = 'http://localhost:3000'

interface EpisodeSummary {
  id: string
  title: string
}
interface Line {
  id: string
  idx: number
  speaker: string
  voice: string
}
interface Episode {
  id: string
  title: string
  status: string
  hosts: { name: string; voice: string }[]
  lines: Line[]
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  const body = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${body.error ?? 'napaka'}`)
  return body
}

async function generateAudio(episode: Episode): Promise<number> {
  const lines = episode.lines.slice().sort((a, b) => a.idx - b.idx)
  let done = 0
  let failed = 0

  async function worker(queue: Line[]) {
    while (queue.length > 0) {
      const line = queue.shift()
      if (!line) return
      try {
        await api(`/api/lines/${line.id}/audio`, { method: 'POST' })
        done++
        console.log(`  ✓ [${done}/${lines.length}] ${line.speaker} (${line.voice})`)
      } catch (err) {
        failed++
        console.log(`  ✗ vrstica ${line.idx}: ${err instanceof Error ? err.message : err}`)
      }
    }
  }

  const queue = [...lines]
  await Promise.all([worker(queue), worker(queue)]) // vzporednost 2
  return failed
}

async function main() {
  // 1) Izbriši obstoječe epizode
  const { episodes } = await api<{ episodes: EpisodeSummary[] }>('/api/episodes')
  for (const ep of episodes) {
    await api(`/api/episodes/${ep.id}`, { method: 'DELETE' })
    console.log(`🗑  izbrisana: ${ep.title}`)
  }

  // 2) Ustvari dve novi epizodi (zaporedno — LLM)
  const spec = [
    { topic: 'Zakaj je nebo modro?', style: 'education' },
    { topic: 'Je ananas na pici zločin ali genij?', style: 'debate' },
  ]

  for (const { topic, style } of spec) {
    console.log(`\n🎙  pišem scenarij: "${topic}" (${style}) …`)
    const { episode } = await api<{ episode: Episode }>('/api/episodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, style, language: 'sl' }),
    })
    console.log(`   naslov: ${episode.title}`)
    console.log(
      `   voditelja: ${episode.hosts.map((h) => `${h.name} (${h.voice})`).join(' & ')}, ${episode.lines.length} vrstic`,
    )

    const failed = await generateAudio(episode)
    const { episodes: check } = await api<{ episodes: EpisodeSummary[] }>('/api/episodes')
    const summary = check.find((e) => e.id === episode.id)
    console.log(
      `   → ready ${summary?.readyLines}/${summary?.lineCount}, status=${summary?.status}, napake=${failed}`,
    )
  }

  console.log('\n✅ Končano')
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
