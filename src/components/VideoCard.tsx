import Image from 'next/image';
import { Eye, Clock, Play } from 'lucide-react';
import { formatNumber, formatDate } from '@/lib/utils';
import type { Video } from '@/lib/types';

export function VideoCard({ video }: { video: Video }) {
  return (
    <a
      href={video.youtube_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-xs backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-teal-500/40 hover:shadow-glow-sm dark:border-slate-800 dark:bg-slate-900/80"
    >
      <div className="relative aspect-video overflow-hidden bg-slate-950">
        {video.thumbnail && (
          <Image
            src={video.thumbnail}
            alt={video.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-slate-950/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex items-center justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-500/90 text-white shadow-lg backdrop-blur transition-transform group-hover:scale-110">
            <Play className="h-5 w-5 fill-current ml-0.5" />
          </span>
        </div>
        {video.duration && (
          <span className="absolute bottom-2.5 right-2.5 rounded-lg bg-black/80 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">
            {video.duration}
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-800 transition-colors group-hover:text-teal-600 dark:text-slate-100 dark:group-hover:text-teal-400">
          {video.title}
        </h3>
        <p className="mt-1.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
          {video.channel}
        </p>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-400 dark:border-slate-800/80">
          <span className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5 text-teal-500/80" /> {formatNumber(video.views)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-cyan-500/80" /> {formatDate(video.published_at)}
          </span>
        </div>
      </div>
    </a>
  );
}
