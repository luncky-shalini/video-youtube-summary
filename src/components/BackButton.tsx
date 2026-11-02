'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export function BackButton({ label }: { label?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 text-slate-600 shadow-xs backdrop-blur transition hover:border-teal-500/50 hover:bg-teal-50/50 hover:text-teal-600 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-teal-500/40 dark:hover:bg-slate-800 dark:hover:text-teal-400"
      aria-label={label ?? 'Go back'}
      title={label ?? 'Go back'}
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );
}
