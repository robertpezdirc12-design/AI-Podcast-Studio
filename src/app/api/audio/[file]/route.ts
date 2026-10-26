import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { AUDIO_DIR } from '@/lib/podcast-ai'

type Ctx = { params: Promise<{ file: string }> }

const SAFE_FILENAME = /^[A-Za-z0-9._-]+$/

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { file } = await ctx.params

    if (!SAFE_FILENAME.test(file) || file.includes('..')) {
      return NextResponse.json({ error: 'Neveljavno ime datoteke' }, { status: 400 })
    }

    const filePath = path.join(AUDIO_DIR, file)
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Datoteka ne obstaja' }, { status: 404 })
    }

    const buffer = fs.readFileSync(filePath)
    const contentType = file.toLowerCase().endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav'
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Accept-Ranges': 'bytes',
      },
    })
  } catch (error) {
    console.error('[api/audio/:file GET]', error)
    return NextResponse.json({ error: 'Napaka pri branju zvoka' }, { status: 500 })
  }
}
