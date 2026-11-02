import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { NotesPanel } from '@/components/NotesPanel';
import { ExportPdfButton } from '@/components/ExportPdfButton';
import { BackButton } from '@/components/BackButton';
import { excludeSections } from '@/lib/markdown';
import { formatDate } from '@/lib/utils';
import type { Summary } from '@/lib/types';

export default async function ContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireUser();
  const supabase = await createClient();

  const { data: summary } = await supabase
    .from('summaries')
    .select('*')
    .eq('id', id)
    .single<Summary>();

  if (!summary) notFound();

  const content = excludeSections(summary.summary, ['interview', 'quiz']);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-start gap-4">
          <BackButton />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              Core Study Guide
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl text-slate-900 dark:text-white">
              {summary.topic}
            </h1>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              Structured study material &bull; {formatDate(summary.created_at)}
            </p>
          </div>
        </div>
        <ExportPdfButton
          summaryId={summary.id}
          topic={summary.topic}
          userName={profile.name ?? profile.email}
          searchDate={formatDate(summary.created_at)}
          markdown={content}
          heading="SynapseTube — Core Study Guide"
          fileSuffix="study-content"
        />
      </div>

      <NotesPanel markdown={content} />
    </div>
  );
}
