const fs = require('fs');
let c = fs.readFileSync('src/components/VideoSubtitleStudio.tsx', 'utf8');

// 1. Add FileText to lucide-react and import exportSynopsisPdf
if (!c.includes('FileText')) {
  c = c.replace(
    '  FileDown,',
    '  FileDown,\r\n  FileText,'
  );
}
if (!c.includes("import { exportSynopsisPdf } from '@/lib/pdfGenerator';")) {
  c = c.replace(
    "} from 'lucide-react';",
    "} from 'lucide-react';\r\nimport { exportSynopsisPdf } from '@/lib/pdfGenerator';"
  );
}

// 2. Add videoDuration and isGeneratingPdf states
if (!c.includes('isGeneratingPdf')) {
  c = c.replace(
    '  const [isTranslating, setIsTranslating] = useState<boolean>(false);',
    '  const [isTranslating, setIsTranslating] = useState<boolean>(false);\r\n  const [videoDuration, setVideoDuration] = useState<number>(0);\r\n  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);'
  );
}

// 3. YouTube player onReady get duration
if (!c.includes('setVideoDuration(d);')) {
  c = c.replace(
    'if (typeof t === \'number\') setCurrentTime(t);',
    'if (typeof t === \'number\') setCurrentTime(t);\r\n                const d = event.target.getDuration?.();\r\n                if (typeof d === \'number\') setVideoDuration(d);'
  );
}

// 4. Update YouTube setVideoSource name
c = c.replace(
  'name: `YouTube: ${data.videoId} (${detectedSource})`,',
  'name: data.title || `YouTube: ${data.videoId} (${detectedSource})`,'
);

// 5. Update HTML video tag
if (!c.includes('onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}')) {
  c = c.replace(
    'onTimeUpdate={handleTimeUpdate}',
    'onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}\r\n                onTimeUpdate={handleTimeUpdate}'
  );
}

// 6. Add handleDownloadPdfSynopsis
const pdfHandler = `  // PDF Synopsis Handler
  const handleDownloadPdfSynopsis = async () => {
    if (!videoSource || currentCues.length === 0) return;
    setIsGeneratingPdf(true);
    setTranslationError(null);
    try {
      const dur =
        videoDuration ||
        videoRef.current?.duration ||
        (playerRef.current?.getDuration ? playerRef.current.getDuration() : 0) ||
        (currentCues.length > 0 ? Math.max(...currentCues.map((c) => c.end)) : 0);

      const res = await fetch('/api/subtitles/synopsis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: videoSource.name || 'Video Title',
          language: activeLanguage,
          cues: currentCues,
          duration: dur,
          sourceType: videoSource.type === 'youtube' ? 'YouTube' : 'Local Video File',
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to generate synopsis');
      }

      const data = await res.json();
      if (!data.synopsis) {
        throw new Error('Invalid synopsis response from server');
      }

      await exportSynopsisPdf(data.synopsis);
    } catch (err) {
      console.error('PDF synopsis error:', err);
      setTranslationError(
        \`PDF Synopsis Export Failed: \${err instanceof Error ? err.message : String(err)}\`
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Reset video state`;

if (!c.includes('handleDownloadPdfSynopsis')) {
  c = c.replace('  // Reset video state', pdfHandler);
}

// 7. Add PDF Synopsis button next to TXT
const pdfButton = `                    <button
                      type="button"
                      onClick={handleDownloadPdfSynopsis}
                      disabled={isGeneratingPdf}
                      className="flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-2.5 py-2 text-xs font-bold text-teal-800 shadow-2xs transition hover:bg-teal-100 disabled:opacity-60 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300 dark:hover:bg-teal-900/60"
                      title="Download Complete 11-Section Video Synopsis & Full Transcript as PDF"
                    >
                      {isGeneratingPdf ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-600" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                      )}
                      <span>{isGeneratingPdf ? 'PDF…' : 'PDF Synopsis'}</span>
                    </button>
                  </div>`;

if (!c.includes('PDF Synopsis')) {
  c = c.replace(
    '                      <span>TXT</span>\r\n                    </button>\r\n                  </div>',
    '                      <span>TXT</span>\r\n                    </button>\r\n' + pdfButton
  );
}

fs.writeFileSync('src/components/VideoSubtitleStudio.tsx', c);
console.log('VideoSubtitleStudio updated successfully');

