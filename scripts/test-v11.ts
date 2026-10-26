/* Test Task 11: viri, show notes, ask, SRT, ovitek, studio-polish */
import fs from 'fs'
import { fetchSourceContent, generatePodcastScript, generateShowNotes, generateAskResponse, buildSrt, ttsToFile, wavDurationMs } from '../src/lib/podcast-ai'

async function main() {
  console.log('=== 1) fetchSourceContent ===')
  const source = await fetchSourceContent('https://sl.wikipedia.org/wiki/Mesa')
  console.log('OK, length:', source.length, '| začetek:', source.slice(0, 180))

  console.log('\n=== 2) generatePodcastScript (long + focus + source) ===')
  const script = await generatePodcastScript({
    topic: 'Mesa: najbolj arheološko mesto na svetu?',
    style: 'debate',
    language: 'sl',
    length: 'long',
    focus: 'naj bo malo tekmovalno, kdo ve več zanimivosti',
    sourceContent: source,
  })
  console.log('title:', script.title)
  console.log('hosts:', script.hosts.map((h) => `${h.name}/${h.voice}`).join(', '))
  console.log('lines:', script.lines.length)
  const chapters = script.lines.filter((l) => l.chapter)
  console.log('chapters:', chapters.map((l) => l.chapter).join(' | '))

  console.log('\n=== 3) generateShowNotes ===')
  const notes = await generateShowNotes({
    title: script.title,
    topic: 'Mesa',
    language: 'sl',
    lines: script.lines.map((l) => ({ speaker: l.speaker, text: l.text })),
  })
  console.log('summary:', notes.summary.slice(0, 200))
  console.log('takeaways:', notes.takeaways)

  console.log('\n=== 4) ttsToFile (polish: loudnorm) ===')
  const first = script.lines[0]
  const t = await ttsToFile(first.text, first.voice, first.speed, 'test_v11.wav')
  const buf = fs.readFileSync(t.filePath)
  console.log('durationMs:', t.durationMs, 'wavDurationMs:', wavDurationMs(buf), 'bytes:', buf.length)
  console.log('sampleRate:', buf.readUInt32LE(24), 'chapters test line:', first.chapter)

  console.log('\n=== 5) generateAskResponse ===')
  const ask = await generateAskResponse({
    episodeTitle: script.title,
    hosts: script.hosts,
    question: 'Koliko je stara mesa in ali res jo je videl boga?',
    language: 'sl',
  })
  console.log('ask lines:', ask.length)
  for (const l of ask) console.log(` - ${l.speaker} (${l.voice}): ${l.text.slice(0, 110)}`)

  console.log('\n=== 6) buildSrt ===')
  const srt = buildSrt([
    { speaker: 'Rok', text: 'Živjo, dobrodošli!', audioPath: '/api/audio/test_v11.wav' },
    { speaker: 'Matej', text: 'Druga vrstica za test.', audioPath: '/api/audio/test_v11.wav' },
  ])
  console.log(srt.slice(0, 300))

  console.log('\n=== 7) generateCoverArt ===')
  const { generateCoverArt } = await import('../src/lib/podcast-ai')
  const coverPath = await generateCoverArt({ id: 'test_v11', title: script.title, topic: 'Mesa', style: 'debate' })
  const stat = fs.statSync(coverPath.replace('/api/cover/', './db/covers/'))
  console.log('coverPath:', coverPath, 'bytes:', stat.size)

  fs.unlinkSync('./db/audio/test_v11.wav')
  console.log('\nVSE OK ✅')
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
