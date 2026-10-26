import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serializeEpisode, VOICE_IDS, isVoiceId, type VoiceId } from '@/lib/podcast-ai'
import { parseScript, SCRIPT_LIMITS } from '@/lib/script-parser'

/**
 * Ustvari epizodo iz UPORABNIKOVE lastne skripte — 100 % BREZ AI modelov.
 * Brez LLM, brez stroškov: skripto razčleni lokalni razčlenjevalnik, zvok pa
 * nato (odjemalec prek /api/lines/:id/audio) sintetizira lokalni Piper TTS.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      title?: unknown
      scriptText?: unknown
      voices?: unknown
    }

    const scriptText = typeof body.scriptText === 'string' ? body.scriptText : ''
    if (scriptText.trim().length < SCRIPT_LIMITS.minChars) {
      return NextResponse.json(
        { error: `Skripta je prekratka (najmanj ${SCRIPT_LIMITS.minChars} znakov)` },
        { status: 400 },
      )
    }
    if (scriptText.length > SCRIPT_LIMITS.maxChars) {
      return NextResponse.json(
        { error: `Skripta je predolga (največ ${SCRIPT_LIMITS.maxChars} znakov)` },
        { status: 400 },
      )
    }

    const parsed = parseScript(scriptText)
    if (parsed.lines.length < SCRIPT_LIMITS.minLines) {
      return NextResponse.json(
        { error: `Skripta mora imeti vsaj ${SCRIPT_LIMITS.minLines} vrstici dialoga` },
        { status: 400 },
      )
    }

    // Naslov: uporabnikov ali iz prve vrstice skripte.
    const userTitle = typeof body.title === 'string' ? body.title.trim() : ''
    let title = userTitle.slice(0, 120)
    if (!title) {
      title = parsed.lines[0].text.slice(0, 60)
      if (parsed.lines[0].text.length > 60) title += '…'
    }
    if (title.length < 2) title = 'Moja epizoda'

    // Dodelitev glasov: uporabnikova izbira > privzeti cikel po vrstnem redu.
    const userVoices =
      typeof body.voices === 'object' && body.voices !== null
        ? (body.voices as Record<string, unknown>)
        : {}
    const voiceFor = (speaker: string, index: number): VoiceId => {
      const chosen = userVoices[speaker]
      if (isVoiceId(chosen)) return chosen
      return VOICE_IDS[index % VOICE_IDS.length] as VoiceId
    }

    const hosts = parsed.speakers.map((name, i) => ({
      name,
      voice: voiceFor(name, i),
      speed: 1.0,
    }))
    const voiceByName = new Map(hosts.map((h) => [h.name.toLowerCase(), h.voice]))

    const episode = await db.episode.create({
      data: {
        title,
        topic: title,
        style: 'custom',
        language: 'sl',
        length: 'custom',
        sourceType: 'script',
        sourceText: scriptText,
        status: 'script_ready',
        hostsJson: JSON.stringify(hosts),
        summaryJson: null,
        lines: {
          create: parsed.lines.map((line, idx) => ({
            idx,
            speaker: line.speaker,
            voice: voiceByName.get(line.speaker.toLowerCase()) ?? 'artur',
            speed: 1.0,
            emotion: null,
            text: line.text,
            chapter: line.chapter,
          })),
        },
      },
      include: { lines: true },
    })

    return NextResponse.json({ episode: serializeEpisode(episode) })
  } catch (error) {
    console.error('[api/episodes/script POST]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ustvarjanje epizode iz skripte ni uspelo' },
      { status: 500 },
    )
  }
}
