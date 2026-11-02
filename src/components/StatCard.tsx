import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  href?: string;
}

function CardBody({ icon: Icon, label, value, hint }: Omit<Props, 'href'>) {
  return (
    <div className="relative overflow-hidden">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500/10 to-cyan-500/10 text-teal-600 ring-1 ring-teal-500/20 dark:from-teal-500/20 dark:to-cyan-500/20 dark:text-teal-400 dark:ring-teal-500/30">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        {value}
      </p>
      {hint && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-500" />
          <span>{hint}</span>
        </div>
      )}
    </div>
  );
}

export function StatCard({ href, ...body }: Props) {
  const base =
    'relative rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 dark:border-slate-800 dark:bg-slate-900/70';

  if (href) {
    return (
      <Link
        href={href}
        className={`group block ${base} hover:-translate-y-1 hover:border-teal-500/40 hover:shadow-glow-sm dark:hover:border-teal-500/40`}
      >
        <CardBody {...body} />
      </Link>
    );
  }
  return (
    <div className={base}>
      <CardBody {...body} />
    </div>
  );
}
