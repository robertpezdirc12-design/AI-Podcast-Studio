'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ['Preslednica'], action: 'Predvajaj / pavza' },
  { keys: ['←', '→'], action: 'Skok nazaj / naprej za 10 s' },
  { keys: ['↑', '↓'], action: 'Prejšnja / naslednja vrstica' },
  { keys: ['M'], action: 'Utišaj / povrni zvok' },
  { keys: ['/'], action: 'Iskanje po scenariju' },
  { keys: ['?'], action: 'Pokaži bližnjice' },
];

/** Pomoč za tipkovniške bližnjice (YouTube stil — odpre se s tipko »?«). */
export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-zinc-800 bg-zinc-900 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Tipkovniške bližnjice</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Bližnjice delujejo, ko tipka ni v besedilnem polju.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2.5">
          {SHORTCUTS.map((item) => (
            <li key={item.action} className="flex items-center justify-between gap-4 text-sm">
              <span className="flex flex-wrap items-center gap-1">
                {item.keys.map((key) => (
                  <kbd
                    key={key}
                    className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-zinc-100 shadow-sm"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
              <span className="text-right text-zinc-400">{item.action}</span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
