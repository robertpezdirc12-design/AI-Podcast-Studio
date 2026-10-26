/**
 * Enkratni skript (Task 20): regenerira SCENARIJO epizode z novimi pravili
 * sodelovalnega dialoga (odzivi na drug drugega, imena, backchanneli, kratki
 * turni) in sintetizira vse vrstice na novo. Počisti zastarele izvoze/citate.
 * Zaženi: bun run scripts/regen-episode-dialogue.ts [episodeId]
 */
import fs from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import {
  AUDIO_DIR,
  generatePodcastScript,
  generateShowNotes,
  removeEpisodeExport,
  removeEpisodeLineClips,
  ttsToFile,
} from '@/lib/podcast-ai'

const EPISODE_ID = process.argv[2] || 'cmvo9p87v000arj9iw7b8gjf1'

async function main() {
  const ep = await db.episode.findUnique({
    where: { id: EPISODE_ID },
    include: { lines: { orderBy: { idx: 'asc' } } },
  })
  if (!ep) throw new Error(`Epizoda ${EPISODE_ID} ne obstaja`)

  console.log(`▶ Regeneriram scenarij: "${ep.title}" (tema: ${ep.topic})`)

  const script = await generatePodcastScript({
    topic: ep.topic,
    style: ep.style,
    language: ep.language,
    length: ep.length,
    focus: ep.focus ?? undefined,
    sourceContent: ep.sourceText ?? undefined,
  })
  console.log(`  nova skripta: ${script.lines.length} vrstic, naslov "${script.title}"`)

  // Show notes (neuspel poskus NE prekliče regeneracije)
  let summaryJson = ep.summaryJson
  try {
    const notes = await generateShowNotes({
      title: script.title,
      topic: ep.topic,
      language: ep.language,
      lines: script.lines.map((l) => ({ speaker: l.speaker, text: l.text })),
    })
    summaryJson = JSON.stringify(notes)
  } catch (err) {
    console.error('  show notes ni uspel (ostaja star):', err instanceof Error ? err.message : err)
  }

  // Stare vrstice: pobriši izvoze/citate in osirotele zvočne datoteke
  const oldIds = ep.lines.map((l) => l.id)
  removeEpisodeExport(ep.id)
  removeEpisodeLineClips(oldIds)
  for (const l of ep.lines) {
    if (!l.audioPath) continue
    const file = path.join(AUDIO_DIR, path.basename(l.audioPath))
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file)
    } catch {
      // ignore
    }
  }

  // Zamenjaj vrstice + naslov/gostitelje
  await db.$transaction(async (tx) => {
    await tx.line.deleteMany({ where: { episodeId: ep.id } })
    await tx.episode.update({
      where: { id: ep.id },
      data: {
        title: script.title,
        hostsJson: JSON.stringify(script.hosts),
        summaryJson,
        status: 'script_ready',
      },
    })
    await tx.line.createMany({
      data: script.lines.map((line, idx) => ({
        episodeId: ep.id,
        idx,
        speaker: line.speaker,
        voice: line.voice,
        speed: line.speed,
        emotion: line.emotion,
        text: line.text,
        chapter: line.chapter,
      })),
    })
  })

  // Sinteza novih vrstic (Edge TTS, ~3 s/vrstico)
  const lines = await db.line.findMany({ where: { episodeId: ep.id }, orderBy: { idx: 'asc' } })
  let ok = 0
  let fail = 0
  for (const line of lines) {
    const filename = `${line.id}.wav`
    try {
      const res = await ttsToFile(line.text, line.voice, line.speed, filename)
      await db.line.update({
        where: { id: line.id },
        data: { audioPath: `/api/audio/${filename}` },
      })
      ok += 1
      const em = line.emotion ? ` [${line.emotion}]` : ''
      const preview = line.text.slice(0, 58)
      console.log(
        `  ✓ ${String(line.idx + 1).padStart(2)}. ${line.speaker}${em} ${res.durationMs} ms — ${preview}${line.text.length > 58 ? '…' : ''}`,
      )
    } catch (err) {
      fail += 1
      console.error(`  ✗ ${line.idx + 1}. [${line.voice}]`, err instanceof Error ? err.message : err)
    }
  }

  const status = fail === 0 ? 'ready' : 'script_ready'
  await db.episode.update({ where: { id: ep.id }, data: { status } })
  console.log(`\nKončano: ${ok}/${lines.length} vrstic uspešno, ${fail} napak. Status: ${status}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
