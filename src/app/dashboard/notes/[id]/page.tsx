import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookOpen, MessageSquareText, Youtube, Sparkles, Layers } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { NotesPanel } from '@/components/NotesPanel';
import { VideoCard } from '@/components/VideoCard';
import { ExportPdfButton } from '@/components/ExportPdfButton';
import { BackButton } from '@/components/BackButton';
import { formatDate } from '@/lib/utils';
import type { Summary, Video } from '@/lib/types';

export default async function NotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireUser();
  const supabase = await createClient();

  const { data: summary } = await supabase
    .from('summaries')
    .select('*')
    .eq('id', id)
    .single<Summary>();

  if (!summary) notFound();

  const { data: videoRows } = await supabase
    .from('videos')
    .select('*')
    .eq('search_id', summary.search_id)
    .order('created_at', { ascending: true });

  const videos = (videoRows ?? []) as Video[];

  const modules = [
    {
      href: `/dashboard/notes/${summary.id}/content`,
      label: 'Core Study Guide',
      icon: BookOpen,
      desc: 'Structured takeaways & concepts',
      color: 'text-teal-600 dark:text-teal-400 bg-teal-500/10 ring-teal-500/20',
    },
    {
      href: `/dashboard/notes/${summary.id}/interview`,
      label: 'Interview Questions',
      icon: MessageSquareText,
      desc: 'Technical Q&A + PDF export',
      color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 ring-cyan-500/20',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header bar */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-start gap-4">
          <BackButton label="Back to History" />
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
                <Sparkles className="h-3 w-3" />
              </span>
              <p className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                Video Study Document
              </p>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl text-slate-900 dark:text-white">
              {summary.topic}
            </h1>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              Synthesized from {videos.length} authoritative source video{videos.length === 1 ? '' : 's'} &bull; {formatDate(summary.created_at)}
            </p>
          </div>
        </div>

        <ExportPdfButton
          summaryId={summary.id}
          topic={summary.topic}
          userName={profile.name ?? profile.email}
          searchDate={formatDate(summary.created_at)}
          markdown={summary.summary}
          heading="SynapseTube — Synthesized Study Document"
        />
      </div>

      {/* Modules Selector */}
      <div className="grid gap-3 sm:grid-cols-2">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs backdrop-blur transition-all duration-200 hover:-translate-y-1 hover:border-teal-500/40 hover:shadow-glow-sm dark:border-slate-800 dark:bg-slate-900/80"
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${m.color}`}>
              <m.icon className="h-5 w-5" />
            </span>
            <div>
              <span className="block text-sm font-bold text-slate-800 transition-colors group-hover:text-teal-600 dark:text-slate-200 dark:group-hover:text-teal-400">
                {m.label}
              </span>
              <span className="block text-xs text-slate-400">{m.desc}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Source Videos Section */}
      {videos.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <Youtube className="h-5 w-5 text-red-500" /> Source YouTube Videos ({videos.length})
            </h2>
            <span className="text-xs text-slate-400">Direct links with timestamps</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        </section>
      )}

      {/* Markdown Notes Panel */}
      <NotesPanel markdown={summary.summary} />
    </div>
  );
}
