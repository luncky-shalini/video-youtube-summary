'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, Sparkles, Wand2, Compass, Layers, CheckCircle2 } from 'lucide-react';

const SUGGESTIONS = [
  { label: 'Next.js 15 & React 19', icon: '⚡' },
  { label: 'System Design & Scalability', icon: '🏗️' },
  { label: 'Python & Fast APIs', icon: '🐍' },
  { label: 'Machine Learning Fundamentals', icon: '🧠' },
  { label: 'Docker & Kubernetes', icon: '☸️' },
  { label: 'Cloud Architecture & AWS', icon: '☁️' },
  { label: 'Cyber Security & Zero Trust', icon: '🛡️' },
];

const STAGES = [
  'Querying YouTube for high-authority videos…',
  'Extracting multi-video transcripts & captions…',
  'Synthesizing insights & cross-referencing concepts…',
  'Building comprehensive study guide, quiz & interview Qs…',
];

export function SearchBox() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function search(t: string) {
    const query = t.trim();
    if (!query || loading) return;
    setLoading(true);
    setError(null);
    setStage(0);

    const ticker = setInterval(
      () => setStage((s) => Math.min(s + 1, STAGES.length - 1)),
      11_000,
    );

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: query }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Search failed');
      router.push(`/dashboard/notes/${json.summaryId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    } finally {
      clearInterval(ticker);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 p-6 shadow-sm backdrop-blur-md transition-all dark:border-slate-800 dark:bg-slate-900/80">
      {/* Background subtle radial glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              AI Multi-Video Knowledge Engine
            </span>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
            Top 10 YouTube Videos &bull; Auto-Synthesized
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            search(topic);
          }}
          className="relative flex flex-col gap-2 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Search any skill, concept, framework, or topic…"
              disabled={loading}
              maxLength={200}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10 disabled:opacity-60 dark:border-slate-700/80 dark:bg-slate-950/60 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-teal-400 dark:focus:bg-slate-950"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !topic.trim()}
            className="group flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:from-teal-500 hover:to-cyan-500 hover:shadow-glow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4 transition-transform group-hover:rotate-12" />
            )}
            <span>{loading ? 'Synthesizing…' : 'Synthesize Notes'}</span>
          </button>
        </form>

        {loading && (
          <div className="mt-5 rounded-2xl border border-teal-500/20 bg-teal-50/40 p-4 dark:border-teal-500/30 dark:bg-teal-950/20">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-2 text-teal-800 dark:text-teal-300">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                </span>
                {STAGES[stage]}
              </span>
              <span className="font-mono text-teal-700 dark:text-teal-400">
                Step {stage + 1} / {STAGES.length}
              </span>
            </div>

            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-teal-200/50 dark:bg-teal-950/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-1000 ease-out"
                style={{ width: `${((stage + 1) / STAGES.length) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
              Processing 10 expert videos and consolidating transcripts into master notes usually takes 60–90 seconds.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50/80 p-3.5 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        {!loading && (
          <div className="mt-5">
            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Compass className="h-3.5 w-3.5 text-teal-500" /> Popular study topics:
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setTopic(item.label);
                    search(item.label);
                  }}
                  className="group flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-slate-600 shadow-xs backdrop-blur transition hover:border-teal-500/50 hover:bg-teal-50/60 hover:text-teal-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-teal-500/40 dark:hover:bg-slate-800 dark:hover:text-teal-300"
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
