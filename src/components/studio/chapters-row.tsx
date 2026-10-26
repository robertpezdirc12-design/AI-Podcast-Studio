'use client';

import { BookOpen } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface ChapterChip {
  title: string;
  /** Indeks prve vrstice tega poglavja v seznamu vrstic. */
  index: number;
}

interface ChaptersRowProps {
  chapters: ChapterChip[];
  /** Indeks trenutno predvajane vrstice (za označbo aktivnega poglavja). */
  activeIndex: number | null;
  onJump: (index: number) => void;
}

/**
 * Vodoravno pomikalna vrstica čipov poglavij (nad karaoke seznamom).
 * Klik na čip skoči na prvo vrstico poglavja.
 */
export function ChaptersRow({ chapters, activeIndex, onJump }: ChaptersRowProps) {
  if (chapters.length === 0) return null;

  // Aktivno poglavje = zadnje poglavje, ki se začne na ali pred trenutno vrstico.
  let activeChapterIdx = -1;
  if (activeIndex !== null) {
    for (let i = 0; i < chapters.length; i += 1) {
      if (chapters[i].index <= activeIndex) activeChapterIdx = i;
      else break;
    }
  }

  return (
    <div
      role="navigation"
      aria-label="Poglavja epizode"
      className="podcast-scroll -mx-1 flex gap-2 overflow-x-auto px-1 py-1"
    >
      {chapters.map((chapter, i) => (
        <button
          key={`${chapter.index}-${chapter.title}`}
          type="button"
          onClick={() => onJump(chapter.index)}
          aria-current={i === activeChapterIdx || undefined}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs whitespace-nowrap text-amber-300 transition-colors hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50',
            i === activeChapterIdx && 'border-amber-500/70 bg-amber-500/25 text-amber-200',
          )}
        >
          <BookOpen className="size-3.5 shrink-0" aria-hidden="true" />
          {chapter.title}
        </button>
      ))}
    </div>
  );
}
