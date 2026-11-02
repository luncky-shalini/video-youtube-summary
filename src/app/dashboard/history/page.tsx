import Link from 'next/link';
import { ArrowLeft, Clock, Coins, FileText, Layers, Search, Sparkles } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime, formatNumber } from '@/lib/utils';
import { BackButton } from '@/components/BackButton';

interface HistoryRow {
  id: string;
  topic: string;
  processing_time_ms: number | null;
  created_at: string;
  summaries: { id: string }[];
  token_usage: { total_tokens: number }[];
}

export default async function HistoryPage() {
  await requireUser();
  const supabase = await createClient();

  // RLS restricts every joined table to this student's own rows.
  const { data } = await supabase
    .from('searches')
    .select('id, topic, processing_time_ms, created_at, summaries(id), token_usage(total_tokens)')
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as HistoryRow[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton label="Back to Dashboard" />
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
              <Sparkles className="h-3 w-3" />
            </span>
            <p className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              Personal Vault
            </p>
          </div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl text-slate-900 dark:text-white">
            Synthesis History
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Every researched topic, generated master notes, and token telemetry. Securely private to you.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                <th className="px-6 py-4">Research Topic</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Token Consumption</th>
                <th className="px-6 py-4">Execution Time</th>
                <th className="px-6 py-4 text-right">Knowledge Guide</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <p className="text-base font-semibold text-slate-600 dark:text-slate-300">No history found</p>
                    <p className="mt-1 text-xs">Run your first search on the dashboard to build your collection.</p>
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const tokens = r.token_usage?.reduce((s, t) => s + (t.total_tokens ?? 0), 0) ?? 0;
                  const summaryId = r.summaries?.[0]?.id;
                  return (
                    <tr
                      key={r.id}
                      className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0" />
                          <span className="truncate max-w-xs sm:max-w-md">{r.topic}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDateTime(r.created_at)}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono font-medium text-slate-600 dark:text-slate-300">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {formatNumber(tokens)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {r.processing_time_ms ? (
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="h-3 w-3 text-teal-500" />
                            {Math.round(r.processing_time_ms / 1000)}s
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {summaryId ? (
                          <Link
                            href={`/dashboard/notes/${summaryId}`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-50 px-3.5 py-1.5 text-xs font-bold text-teal-700 shadow-2xs transition hover:bg-teal-100 dark:bg-teal-950/60 dark:text-teal-300 dark:hover:bg-teal-900/60"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>Study Notes</span>
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
