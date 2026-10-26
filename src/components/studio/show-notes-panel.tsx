'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronDown, Copy, StickyNote } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ShowNotes } from '@/lib/podcast-types';

interface ShowNotesPanelProps {
  summary: ShowNotes;
}

/**
 * Panel »O epizodi«: povzetek + poudarki, z gumbom za kopiranje
 * (kopira povzetek in poudarke kot golo besedilo).
 */
export function ShowNotesPanel({ summary }: ShowNotesPanelProps) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const takeaways = summary.takeaways ?? [];
    const text = [
      summary.summary,
      ...(takeaways.length > 0 ? ['', 'Poudarki:', ...takeaways.map((t) => `- ${t}`)] : []),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Povzetek kopiran v odložišče.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Kopiranje ni uspelo.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="mt-4 border-zinc-800 bg-zinc-900/60 py-5 shadow-none">
        <CardContent className="px-5">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              aria-expanded={open}
              className="flex min-h-8 items-center gap-2 rounded-md text-left transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
            >
              <StickyNote className="size-4 shrink-0 text-amber-400" aria-hidden="true" />
              <span className="text-sm font-semibold text-zinc-100">O epizodi</span>
              <ChevronDown
                className={cn('size-4 text-zinc-500 transition-transform', open && 'rotate-180')}
                aria-hidden="true"
              />
            </button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-amber-300"
              onClick={() => void handleCopy()}
              aria-label="Kopiraj povzetek epizode"
            >
              {copied ? (
                <Check className="size-4 text-emerald-500" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )}
              Kopiraj
            </Button>
          </div>

          {open && (
            <div className="mt-3 space-y-3">
              <p className="text-sm leading-relaxed text-zinc-300">{summary.summary}</p>
              {(summary.takeaways ?? []).length > 0 && (
                <ul className="space-y-1.5">
                  {summary.takeaways.map((takeaway, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                      <Check
                        className="mt-0.5 size-3.5 shrink-0 text-amber-400"
                        aria-hidden="true"
                      />
                      <span className="min-w-0">{takeaway}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
