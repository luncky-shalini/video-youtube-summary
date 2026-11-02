import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  Coins,
  ExternalLink,
  FileText,
  SearchIcon,
  Sparkles,
  Zap,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { StatCard } from '@/components/StatCard';
import { VideoSubtitleStudio } from '@/components/VideoSubtitleStudio';
import { formatNumber, timeAgo } from '@/lib/utils';
import type { Search, Summary } from '@/lib/types';

export default async function DashboardPage() {
  const profile = await requireUser();
  const supabase = await createClient();

  // All queries below are RLS-scoped to this student's own rows.
  const [searchesRes, summariesRes, tokensRes, searchCountRes, summaryCountRes] =
    await Promise.all([
      supabase
        .from('searches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('summaries')
        .select('id, topic, created_at')
        .order('created_at', { ascending: false })
        .limit(6),
      supabase.from('token_usage').select('total_tokens'),
      supabase.from('searches').select('id', { count: 'exact', head: true }),
      supabase.from('summaries').select('id', { count: 'exact', head: true }),
    ]);

  const searches = (searchesRes.data ?? []) as Search[];
  const summaries = (summariesRes.data ?? []) as Pick<Summary, 'id' | 'topic' | 'created_at'>[];
  const totalTokens = (tokensRes.data ?? []).reduce(
    (sum, r) => sum + (r.total_tokens ?? 0),
    0,
  );
  const searchCount = searchCountRes.count ?? 0;
  const summaryCount = summaryCountRes.count ?? 0;

  const firstName = (profile.name ?? profile.email).split(' ')[0];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-6 sm:p-8 text-white shadow-md dark:border-slate-800 dark:bg-gradient-to-r dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-cyan-500/20 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-teal-300 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" /> SynapseTube Workspace
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl text-white">
              Welcome back, <span className="bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">{firstName}</span> 👋
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Upload video files or import YouTube URLs for live synchronized subtitles, multilingual AI translations, and notes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/history"
              className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur transition hover:bg-white/20"
            >
              <FileText className="h-3.5 w-3.5 text-teal-400" /> View History
            </Link>
          </div>
        </div>
      </div>

      {/* Video Upload & Subtitle Studio (Local Video Upload & YouTube URL import only) */}
      <VideoSubtitleStudio />

      {/* Telemetry Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={SearchIcon}
          label="Video Queries"
          value={String(searchCount)}
          hint="Video searches & imports"
          href="/dashboard/history"
        />
        <StatCard
          icon={FileText}
          label="Synthesized Documents"
          value={String(summaryCount)}
          hint="AI master notes & study guides generated"
        />
        <StatCard
          icon={Coins}
          label="AI Inference Tokens"
          value={formatNumber(totalTokens)}
          hint="Total prompt & completion tokens consumed"
        />
      </div>

      {/* Two Column Grid for Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Searches */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
                <SearchIcon className="h-4 w-4" />
              </span>
              Recent Searches
            </h2>
            <Link
              href="/dashboard/history"
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 transition"
            >
              See all &rarr;
            </Link>
          </div>

          {searches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                <SearchIcon className="h-6 w-6" />
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">No searches yet</p>
              <p className="mt-1 text-xs text-slate-400">Enter any topic above to run your first synthesis.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {searches.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-3 transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-2 rounded-xl">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-2 w-2 rounded-full bg-teal-500 shrink-0" />
                    <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {s.topic}
                    </span>
                  </div>
                  <span className="ml-3 shrink-0 text-xs font-medium text-slate-400">
                    {timeAgo(s.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Generated Notes */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400">
                <BookOpen className="h-4 w-4" />
              </span>
              Generated Knowledge Documents
            </h2>
            <Link
              href="/dashboard/history"
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 transition"
            >
              See all &rarr;
            </Link>
          </div>

          {summaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                <BookOpen className="h-6 w-6" />
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">No documents yet</p>
              <p className="mt-1 text-xs text-slate-400">Your AI-synthesized master guides will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {summaries.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 py-3 px-2 rounded-xl transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <Link
                    href={`/dashboard/notes/${s.id}`}
                    className="group min-w-0 flex-1 truncate font-semibold text-slate-800 transition hover:text-teal-600 dark:text-slate-200 dark:hover:text-teal-400"
                  >
                    <span className="truncate">{s.topic}</span>
                  </Link>
                  <Link
                    href={`/dashboard/notes/${s.id}`}
                    className="flex items-center gap-1 shrink-0 rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700 transition hover:bg-teal-100 dark:bg-teal-950/60 dark:text-teal-300 dark:hover:bg-teal-900/60"
                  >
                    <span>Study</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
