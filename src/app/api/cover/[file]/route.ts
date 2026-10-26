import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { COVER_DIR } from '@/lib/podcast-ai'

type Ctx = { params: Promise<{ file: string }> }

/** Servira AI ovitke iz db/covers (s path traversal zaščito). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { file } = await ctx.params
  const name = path.basename(file)
  if (!/^cover_[A-Za-z0-9_-]+\.png$/.test(name)) {
    return NextResponse.json({ error: 'Neveljavna datoteka' }, { status: 400 })
  }
  const filePath = path.join(COVER_DIR, name)
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Ovitek ne obstaja' }, { status: 404 })
  }
  const data = fs.readFileSync(filePath)
  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
