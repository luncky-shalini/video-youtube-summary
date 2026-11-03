'use client';

import { useState, useRef, useEffect, useMemo, ChangeEvent } from 'react';
import {
  Upload,
  Subtitles,
  Languages,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Youtube,
  Film,
  Sparkles,
  FileDown,
  FileText,
  Clock,
  BookOpen,
  Users,
  ListChecks,
} from 'lucide-react';
import { exportSynopsisPdf, exportTranscriptPdf, decodeHtmlEntities } from '@/lib/pdfGenerator';
import { normalizeSpeakerLabel } from '@/lib/speakerUtils';
import { extractAudioChunksFromVideo, extractAudioFromVideoFile, type AudioChunk } from '@/lib/audioExtractor';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface SubtitleCue {
  id: number;
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export function normalizeLanguageName(input?: string): string {
  if (!input) return 'English';
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase().split('-')[0].split('(')[0].trim();

  const map: Record<string, string> = {
    ta: 'Tamil',
    tam: 'Tamil',
    tamil: 'Tamil',
    te: 'Telugu',
    tel: 'Telugu',
    telugu: 'Telugu',
    hi: 'Hindi',
    hin: 'Hindi',
    hindi: 'Hindi',
    en: 'English',
    eng: 'English',
    english: 'English',
    kn: 'Kannada',
    kan: 'Kannada',
    kannada: 'Kannada',
    ml: 'Malayalam',
    mal: 'Malayalam',
    malayalam: 'Malayalam',
    mr: 'Marathi',
    mar: 'Marathi',
    marathi: 'Marathi',
    bn: 'Bengali',
    ben: 'Bengali',
    bengali: 'Bengali',
    gu: 'Gujarati',
    guj: 'Gujarati',
    gujarati: 'Gujarati',
    pa: 'Punjabi',
    pan: 'Punjabi',
    punjabi: 'Punjabi',
    ur: 'Urdu',
    urd: 'Urdu',
    urdu: 'Urdu',
    zh: 'Chinese',
    chi: 'Chinese',
    zho: 'Chinese',
    chinese: 'Chinese',
    ko: 'Korean',
    kor: 'Korean',
    korean: 'Korean',
    ja: 'Japanese',
    jpn: 'Japanese',
    japanese: 'Japanese',
    es: 'Spanish',
    spa: 'Spanish',
    spanish: 'Spanish',
    fr: 'French',
    fra: 'French',
    fre: 'French',
    french: 'French',
    de: 'German',
    deu: 'German',
    ger: 'German',
    german: 'German',
    ru: 'Russian',
    rus: 'Russian',
    russian: 'Russian',
    pt: 'Portuguese',
    por: 'Portuguese',
    portuguese: 'Portuguese',
    it: 'Italian',
    ita: 'Italian',
    italian: 'Italian',
    ar: 'Arabic',
    ara: 'Arabic',
    arabic: 'Arabic',
  };

  if (map[lower]) return map[lower];
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export const SUPPORTED_LANGUAGES = [
  { code: 'Tamil', label: 'Tamil (தமிழ்)' },
  { code: 'Telugu', label: 'Telugu (తెలుగు)' },
  { code: 'Hindi', label: 'Hindi (हिन्दी)' },
  { code: 'English', label: 'English' },
  { code: 'Kannada', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'Malayalam', label: 'Malayalam (മലയാളം)' },
  { code: 'Marathi', label: 'Marathi (मराठी)' },
  { code: 'Bengali', label: 'Bengali (বাংলা)' },
  { code: 'Gujarati', label: 'Gujarati (ગુજરાતી)' },
  { code: 'Punjabi', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'Urdu', label: 'Urdu (اردو)' },
  { code: 'Chinese', label: 'Chinese (中文)' },
  { code: 'Korean', label: 'Korean (한국어)' },
  { code: 'Japanese', label: 'Japanese (日本語)' },
  { code: 'Spanish', label: 'Spanish (Español)' },
  { code: 'French', label: 'French (Français)' },
  { code: 'German', label: 'German (Deutsch)' },
  { code: 'Russian', label: 'Russian (Русский)' },
  { code: 'Portuguese', label: 'Portuguese (Português)' },
  { code: 'Italian', label: 'Italian (Italiano)' },
  { code: 'Arabic', label: 'Arabic (العربية)' },
];

const SUPPORTED_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.mkv'];
const SUPPORTED_MIME_PREFIXES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska'];

function isValidVideoFile(file: File): boolean {
  if (!file) return false;
  const name = file.name.toLowerCase();
  const hasValidExt = SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  const hasValidMime = SUPPORTED_MIME_PREFIXES.some((mime) => file.type.startsWith(mime));
  return hasValidExt || hasValidMime || file.type.startsWith('video/');
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function parseTimestampToSeconds(tsStr?: string): number {
  if (!tsStr) return 0;
  const clean = tsStr.replace(/[\[\]]/g, '').trim();
  const parts = clean.split(':').map((p) => parseFloat(p) || 0);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}

function sanitizeErrorMessage(msg: unknown, defaultFallback: string): string {
  if (!msg) return defaultFallback;
  const str = String(msg instanceof Error ? msg.message : msg).trim();
  if (!str) return defaultFallback;
  const lower = str.toLowerCase();
  if (
    lower === 'fetch failed' ||
    lower === 'failed to fetch' ||
    lower.includes('fetch failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('connection error') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('enotfound') ||
    lower.includes('networkerror')
  ) {
    return 'Connection to server timed out or was interrupted. Please check your network and try again.';
  }
  return str;
}

function cuesToSrt(cues: SubtitleCue[]): string {
  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  const fmt = (sec: number) => {
    const s = Math.max(0, sec);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.min(999, Math.round((s % 1) * 1000));
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
  };

  return cues
    .map((c, i) => `${i + 1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.text}\n`)
    .join('\n');
}

function cuesToVtt(cues: SubtitleCue[]): string {
  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  const fmt = (sec: number) => {
    const s = Math.max(0, sec);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.min(999, Math.round((s % 1) * 1000));
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`;
  };

  return (
    'WEBVTT\n\n' +
    cues
      .map((c, i) => `${i + 1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.text}\n`)
      .join('\n')
  );
}

function cuesToTxt(cues: SubtitleCue[]): string {
  return cues.map((c) => `[${formatTime(c.start)} - ${formatTime(c.end)}] ${c.text}`).join('\n');
}

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function VideoSubtitleStudio() {
  const [videoSource, setVideoSource] = useState<{
    type: 'upload' | 'youtube';
    url: string;
    name: string;
    file?: File;
  } | null>(null);

  // References
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Subtitle state
  // ── Requirement 8: Independent State Variables ─────────────────────────
  const [original_language, setOriginalLanguage] = useState<string>('');
  const [selected_subtitle_language, setSelectedSubtitleLanguage] = useState<string>('');
  const [active_subtitle_language, setActiveSubtitleLanguage] = useState<string>('');
  const [original_subtitles, setOriginalSubtitles] = useState<SubtitleCue[]>([]);
  const [translated_subtitles, setTranslatedSubtitles] = useState<Record<string, SubtitleCue[]>>({});
  const [original_transcript, setOriginalTranscript] = useState<SubtitleCue[]>([]);
  const [original_synopsis, setOriginalSynopsis] = useState<any | null>(null);

  // Aliases for component template and backward compatibility
  const sourceLanguage = original_language;
  const setSourceLanguage = setOriginalLanguage;
  const selectedLanguage = selected_subtitle_language;
  const setSelectedLanguage = setSelectedSubtitleLanguage;
  const activeLanguage = active_subtitle_language;
  const setActiveLanguage = setActiveSubtitleLanguage;

  const cuesByLanguage: Record<string, SubtitleCue[]> = {
    [original_language || 'Original']: original_subtitles,
    ...translated_subtitles,
  };

  // Dynamic available languages list: guaranteed to include detected original language
  const availableLanguages = useMemo(() => {
    const list = [...SUPPORTED_LANGUAGES];
    const canonicalOriginal = original_language ? normalizeLanguageName(original_language) : '';
    if (canonicalOriginal && !list.some((l) => l.code.toLowerCase() === canonicalOriginal.toLowerCase())) {
      list.unshift({ code: canonicalOriginal, label: `${canonicalOriginal} (Original)` });
    }
    const canonicalSelected = selected_subtitle_language ? normalizeLanguageName(selected_subtitle_language) : '';
    if (canonicalSelected && !list.some((l) => l.code.toLowerCase() === canonicalSelected.toLowerCase())) {
      list.push({ code: canonicalSelected, label: canonicalSelected });
    }
    return list;
  }, [original_language, selected_subtitle_language]);
  const [isCcOn, setIsCcOn] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Status and error states
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [isGeneratingSynopsis, setIsGeneratingSynopsis] = useState<boolean>(false);
  const [isGeneratingTranscript, setIsGeneratingTranscript] = useState<boolean>(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  // YouTube embed restriction & companion simulation state
  const [isEmbedRestricted, setIsEmbedRestricted] = useState<boolean>(false);
  const [isPlayingSimulation, setIsPlayingSimulation] = useState<boolean>(false);
  const [currentYouTubeId, setCurrentYouTubeId] = useState<string>('');
  const simulationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const effectiveDuration =
    videoDuration > 0
      ? videoDuration
      : Math.max(...(original_subtitles.map((c) => c.end) || [60]), 60);

  // Simulation player timer for embed-restricted YouTube videos
  useEffect(() => {
    if (!isPlayingSimulation) {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
      return;
    }

    simulationTimerRef.current = setInterval(() => {
      setCurrentTime((prev) => {
        const next = Math.round((prev + 0.2) * 10) / 10;
        if (next >= effectiveDuration) {
          setIsPlayingSimulation(false);
          return 0;
        }
        return next;
      });
    }, 200);

    return () => {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
    };
  }, [isPlayingSimulation, effectiveDuration]);

  // YouTube import input state
  const [youtubeInput, setYoutubeInput] = useState<string>('');
  const [isLoadingYoutube, setIsLoadingYoutube] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'youtube'>('upload');

  // Load YouTube IFrame API script once
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.YT) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      const firstScript = document.getElementsByTagName('script')[0];
      if (firstScript && firstScript.parentNode) {
        firstScript.parentNode.insertBefore(script, firstScript);
      } else {
        document.body.appendChild(script);
      }
    }
  }, []);

  // Clean up object URLs on unmount or reset
  useEffect(() => {
    return () => {
      if (videoSource?.type === 'upload' && videoSource.url.startsWith('blob:')) {
        URL.revokeObjectURL(videoSource.url);
      }
    };
  }, [videoSource]);

  // Synchronize playback timestamp with YouTube IFrame Player API
  useEffect(() => {
    if (videoSource?.type !== 'youtube') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
      }
      return;
    }

    let isCancelled = false;

    const setupPlayer = () => {
      if (isCancelled || typeof window === 'undefined' || !window.YT || !window.YT.Player) return;

      try {
        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch {}
          playerRef.current = null;
        }

        playerRef.current = new window.YT.Player('youtube-studio-player', {
          events: {
            onReady: (event: any) => {
              if (isCancelled) return;
              try {
                const t = event.target.getCurrentTime();
                if (typeof t === 'number') setCurrentTime(t);
                const d = event.target.getDuration?.();
                if (typeof d === 'number') setVideoDuration(d);
              } catch {}
            },
            onStateChange: (event: any) => {
              if (isCancelled) return;
              // 1 = PLAYING
              if (event.data === 1) {
                if (intervalRef.current) clearInterval(intervalRef.current);
                intervalRef.current = setInterval(() => {
                  if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                    try {
                      const t = playerRef.current.getCurrentTime();
                      if (typeof t === 'number') setCurrentTime(t);
                    } catch {}
                  }
                }, 200);
              } else {
                // 2 = PAUSED, 0 = ENDED, 3 = BUFFERING
                if (intervalRef.current) {
                  clearInterval(intervalRef.current);
                  intervalRef.current = null;
                }
                if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                  try {
                    const t = playerRef.current.getCurrentTime();
                    if (typeof t === 'number') setCurrentTime(t);
                  } catch {}
                }
              }
            },
            onError: (event: any) => {
              if (isCancelled) return;
              // YouTube error 101 or 150: creator disabled embed playback
              if (event?.data === 101 || event?.data === 150 || event?.data === 2) {
                setIsEmbedRestricted(true);
              }
            },
          },
        });
      } catch (err) {
        console.warn('Could not initialize YT.Player on iframe:', err);
      }
    };

    if (window.YT && window.YT.Player) {
      setupPlayer();
    } else {
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        setupPlayer();
      };
    }

    // Secondary sync fallback via YouTube postMessage events
    const handleMessage = (e: MessageEvent) => {
      if (isCancelled) return;
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data?.event === 'infoDelivery' && data?.info) {
          if (typeof data.info.currentTime === 'number') {
            setCurrentTime(data.info.currentTime);
          }
        }
      } catch {}
    };

    window.addEventListener('message', handleMessage);

    return () => {
      isCancelled = true;
      window.removeEventListener('message', handleMessage);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
      }
    };
  }, [videoSource]);

  // Video time tracking for local HTML5 video
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Seek video playback handler for both local HTML5 video and YouTube iframe
  const handleSeek = (timeSec: number) => {
    if (typeof timeSec !== 'number' || isNaN(timeSec) || timeSec < 0) return;
    setCurrentTime(timeSec);
    if (videoSource?.type === 'upload' && videoRef.current) {
      videoRef.current.currentTime = timeSec;
      videoRef.current.play().catch(() => {});
    } else if (videoSource?.type === 'youtube') {
      if (isEmbedRestricted) {
        return;
      }
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        playerRef.current.seekTo(timeSec, true);
      } else {
        const iframe = document.getElementById('youtube-studio-player') as HTMLIFrameElement | null;
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'seekTo', args: [timeSec, true] }),
            '*'
          );
        }
      }
    }
  };

  // Video File Selection Handler
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setTranslationError(null);
    setIsEmbedRestricted(false);
    setIsPlayingSimulation(false);
    if (simulationTimerRef.current) {
      clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }

    // Validate file type
    if (!isValidVideoFile(file)) {
      setUploadError(
        'Unsupported file type. Please select a valid video file (MP4, WebM, OGG, MOV, or MKV).'
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Clean up previous blob URL if any
    if (videoSource?.type === 'upload' && videoSource.url.startsWith('blob:')) {
      URL.revokeObjectURL(videoSource.url);
    }

    const objectUrl = URL.createObjectURL(file);
    setVideoSource({
      type: 'upload',
      url: objectUrl,
      name: file.name,
      file,
    });

    await triggerTranscription(file);
  };

  // Automated background synopsis fetcher
  const fetchSynopsisForVideo = async (
    title: string,
    lang: string,
    cues: SubtitleCue[],
    durationSec?: number,
    srcType?: string
  ) => {
    if (!cues || cues.length === 0) return;
    setIsGeneratingSynopsis(true);
    try {
      const res = await fetch('/api/subtitles/synopsis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || 'Video Title',
          language: lang,
          originalLanguage: lang,
          cues,
          duration: durationSec || 0,
          sourceType: srcType || 'Video Upload / YouTube',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.synopsis) {
          setOriginalSynopsis(data.synopsis);
        }
      }
    } catch (err) {
      console.warn('Background synopsis fetch notice:', err);
    } finally {
      setIsGeneratingSynopsis(false);
    }
  };

  // Transcription trigger with client-side audio optimization and resilient chunking
  const triggerTranscription = async (file: File) => {
    setIsTranscribing(true);
    setTranslationError(null);
    try {
      let combinedCues: SubtitleCue[] = [];
      let detectedLang = '';

      // 1. Optimize upload by extracting lightweight 12kHz audio chunks client-side (each strictly <= 2.2MB)
      let chunks: AudioChunk[] | null = null;
      try {
        chunks = await extractAudioChunksFromVideo(file);
      } catch (extractErr) {
        console.warn('Audio chunk extraction notice:', extractErr);
      }

      if (chunks && chunks.length > 0) {
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const formData = new FormData();
          formData.append('file', chunk.blob, `audio_chunk_${i}.wav`);
          formData.append('startOffset', chunk.startOffset.toString());

          const res = await fetch('/api/subtitles/transcribe', {
            method: 'POST',
            body: formData,
          });

          const data = await res.json().catch(() => ({}));
          if (res.ok && data) {
            if (data.language && !detectedLang) {
              detectedLang = data.language;
            }

            const chunkCues: SubtitleCue[] = data.cues || [];
            for (const cue of chunkCues) {
              combinedCues.push({
                ...cue,
                id: combinedCues.length + 1,
              });
            }
          } else {
            console.warn(`Audio chunk ${i} notice:`, data?.error || res.statusText);
          }
        }
      } else {
        // Fallback: direct file upload if <= 4MB
        if (file.size > 4.2 * 1024 * 1024) {
          throw new Error(
            `Video file size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds direct serverless upload limit. Please use a clip under 4MB, or a YouTube URL.`
          );
        }

        const formData = new FormData();
        formData.append('file', file, file.name);

        const res = await fetch('/api/subtitles/transcribe', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            data?.error ||
              'Video transcription failed. Please check your network and try again, or use a YouTube URL.'
          );
        }

        combinedCues = data.cues || [];
        if (data.language) detectedLang = data.language;
      }

      if (combinedCues.length === 0) {
        throw new Error('No speech or dialogue could be detected in this video.');
      }

      const canonicalDetected = normalizeLanguageName(detectedLang || 'English');

      setOriginalLanguage(canonicalDetected);
      setSelectedSubtitleLanguage(canonicalDetected);
      setSelectedLanguage(canonicalDetected);
      setActiveSubtitleLanguage(canonicalDetected);
      setOriginalSubtitles(combinedCues);
      setOriginalTranscript(combinedCues);
      setTranslatedSubtitles({});
      setOriginalSynopsis(null);

      // Automatically fetch full synopsis in original language
      const dur = videoRef.current?.duration || Math.max(...combinedCues.map((c) => c.end), 0);
      fetchSynopsisForVideo(file.name, canonicalDetected, combinedCues, dur, 'Local Video File');
    } catch (err) {
      setTranslationError(
        sanitizeErrorMessage(
          err,
          'Video transcription failed. Please check your network and try again, or use a YouTube URL.'
        )
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  // YouTube URL Loader
  const handleLoadYoutube = async () => {
    const trimmed = youtubeInput.trim();
    if (!trimmed) {
      setUploadError('Please enter a YouTube video URL or Video ID.');
      return;
    }

    setUploadError(null);
    setTranslationError(null);
    setIsLoadingYoutube(true);

    try {
      const res = await fetch('/api/subtitles/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not retrieve YouTube subtitles.');
      }

      const cues: SubtitleCue[] = data.cues || [];
      if (cues.length === 0) {
        throw new Error('No subtitles available for this YouTube video.');
      }

      const rawSource = data.sourceLanguage || data.language || 'English';
      const canonicalDetected = normalizeLanguageName(rawSource);

      setCurrentYouTubeId(data.videoId || '');
      setIsEmbedRestricted(Boolean(data.embedRestricted));
      setIsPlayingSimulation(false);
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }

      setOriginalLanguage(canonicalDetected);
      setSelectedSubtitleLanguage(canonicalDetected);
      setSelectedLanguage(canonicalDetected);
      setActiveSubtitleLanguage(canonicalDetected);
      setOriginalSubtitles(cues);
      setOriginalTranscript(cues);
      setTranslatedSubtitles({});
      setOriginalSynopsis(null);

      const origin = typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
      const embedWithOrigin = `${data.embedUrl}&origin=${origin}&widget_referrer=${origin}`;

      setVideoSource({
        type: 'youtube',
        url: embedWithOrigin,
        name: data.title || `YouTube: ${data.videoId} (${canonicalDetected})`,
      });

      // Automatically fetch full synopsis in original language
      if (cues.length > 0) {
        const dur = Math.max(...cues.map((c) => c.end), 0);
        fetchSynopsisForVideo(data.title || `YouTube: ${data.videoId}`, canonicalDetected, cues, dur, 'YouTube');
      }
    } catch (err) {
      setUploadError(
        sanitizeErrorMessage(
          err,
          'Failed to import YouTube video. Please check the URL or video ID and try again.'
        )
      );
    } finally {
      setIsLoadingYoutube(false);
    }
  };

  // Translation Trigger Handler (Only triggered by clicking Translate)
  const handleTranslate = async () => {
    if (!selectedLanguage) return;
    setTranslationError(null);

    // If target language is the original language, switch to original subtitles immediately
    if (selected_subtitle_language.toLowerCase() === original_language.toLowerCase()) {
      setActiveSubtitleLanguage(original_language);
      return;
    }

    // If already translated and cached in memory, switch immediately
    if (translated_subtitles[selected_subtitle_language] && translated_subtitles[selected_subtitle_language].length > 0) {
      setActiveSubtitleLanguage(selected_subtitle_language);
      return;
    }

    // Base cues strictly from original subtitles / transcript
    const baseCues = original_subtitles.length > 0 ? original_subtitles : original_transcript;
    if (baseCues.length === 0) {
      setTranslationError('No transcript cues available to translate.');
      return;
    }

    setIsTranslating(true);
    try {
      const res = await fetch('/api/subtitles/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cues: baseCues,
          targetLanguage: selected_subtitle_language,
          sourceLanguage: original_language,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTranslationError(
          sanitizeErrorMessage(
            data?.error,
            'Subtitle translation failed. Please check your internet connection and try again.'
          )
        );
        return;
      }

      const translatedCues: SubtitleCue[] = data.cues || [];
      const resolvedLang = data.targetLanguage || selected_subtitle_language;

      setTranslatedSubtitles((prev) => ({
        ...prev,
        [resolvedLang]: translatedCues,
      }));
      setActiveSubtitleLanguage(resolvedLang);
    } catch (err) {
      setTranslationError(
        sanitizeErrorMessage(
          err,
          'Subtitle translation failed. Please check your internet connection and try again.'
        )
      );
    } finally {
      setIsTranslating(false);
    }
  };

  // PDF Synopsis Handler (Only Executive Synopsis in original spoken language)
  const handleDownloadPdfSynopsis = async () => {
    if (!videoSource || (original_transcript.length === 0 && original_subtitles.length === 0 && currentCues.length === 0)) return;
    setIsGeneratingSynopsis(true);
    setTranslationError(null);
    try {
      const dur =
        videoDuration ||
        videoRef.current?.duration ||
        (playerRef.current?.getDuration ? playerRef.current.getDuration() : 0) ||
        (currentCues.length > 0 ? Math.max(...currentCues.map((c) => c.end)) : 0);

      // Use original transcript cues and original spoken language strictly
      const transcriptCues = original_transcript.length > 0 ? original_transcript : original_subtitles;

      let synopsisData = original_synopsis;
      if (!synopsisData) {
        const res = await fetch('/api/subtitles/synopsis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: videoSource.name || 'Video Title',
            language: original_language,
            originalLanguage: original_language,
            cues: transcriptCues,
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
        synopsisData = data.synopsis;
        setOriginalSynopsis(synopsisData);
      }

      await exportSynopsisPdf(synopsisData);
    } catch (err) {
      console.error('PDF synopsis error:', err);
      setTranslationError(
        sanitizeErrorMessage(
          err,
          'PDF Synopsis Export failed. Please check your connection and try again.'
        )
      );
    } finally {
      setIsGeneratingSynopsis(false);
    }
  };

  // Re-generate or fetch full synopsis on demand
  const handleGenerateSynopsis = () => {
    if (!videoSource) return;
    const transcriptCues = original_transcript.length > 0 ? original_transcript : original_subtitles;
    const dur =
      videoDuration ||
      videoRef.current?.duration ||
      (playerRef.current?.getDuration ? playerRef.current.getDuration() : 0) ||
      (transcriptCues.length > 0 ? Math.max(...transcriptCues.map((c) => c.end)) : 0);
    fetchSynopsisForVideo(
      videoSource.name,
      original_language,
      transcriptCues,
      dur,
      videoSource.type === 'youtube' ? 'YouTube' : 'Local Video File'
    );
  };

  // PDF Transcript Handler (Only chronological dialogue in original spoken language / natural code-switching)
  const handleDownloadPdfTranscript = async () => {
    if (!videoSource || (original_transcript.length === 0 && original_subtitles.length === 0 && currentCues.length === 0)) return;
    setIsGeneratingTranscript(true);
    setTranslationError(null);
    try {
      const dur =
        videoDuration ||
        videoRef.current?.duration ||
        (playerRef.current?.getDuration ? playerRef.current.getDuration() : 0) ||
        (currentCues.length > 0 ? Math.max(...currentCues.map((c) => c.end)) : 0);

      // Always use original spoken language transcript cues to preserve natural spoken dialogue and code-switching
      const transcriptCues = original_transcript.length > 0 ? original_transcript : original_subtitles;

      await exportTranscriptPdf({
        title: videoSource.name || 'Video Title',
        durationFormatted: formatTime(dur),
        originalLanguage: original_language,
        sourceType: videoSource.type === 'youtube' ? 'YouTube' : 'Local Video File',
        cues: transcriptCues,
      });
    } catch (err) {
      console.error('PDF transcript error:', err);
      setTranslationError(
        sanitizeErrorMessage(
          err,
          'PDF Transcript Export failed. Please check your connection and try again.'
        )
      );
    } finally {
      setIsGeneratingTranscript(false);
    }
  };

  // Reset video state
  const handleReset = () => {
    if (videoSource?.type === 'upload' && videoSource.url.startsWith('blob:')) {
      URL.revokeObjectURL(videoSource.url);
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch {}
      playerRef.current = null;
    }
    setVideoSource(null);
    setOriginalLanguage('');
    setSelectedSubtitleLanguage('');
    setSelectedLanguage('');
    setActiveSubtitleLanguage('');
    setOriginalSubtitles([]);
    setTranslatedSubtitles({});
    setOriginalTranscript([]);
    setOriginalSynopsis(null);
    setUploadError(null);
    setTranslationError(null);
    setCurrentTime(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Find the currently active subtitle cue based on video timestamp
  const currentCues =
    active_subtitle_language === original_language
      ? original_subtitles
      : translated_subtitles[active_subtitle_language] || original_subtitles;
  const activeCue =
    isCcOn && currentCues.length > 0
      ? currentCues.find((c) => currentTime >= c.start && currentTime <= c.end)
      : null;

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 sm:p-8">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mp4,.webm,.ogg,.mov,.mkv"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload Video File"
      />

      {/* ── 1. INITIAL SCREEN (Before video is uploaded / selected) ────────── */}
      {!videoSource && (
        <div className="flex flex-col items-center text-center">
          {/* Header Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-50/80 px-3.5 py-1 text-xs font-bold text-teal-700 backdrop-blur dark:bg-teal-950/50 dark:text-teal-300">
            <Sparkles className="h-3.5 w-3.5 text-teal-500" />
            <span>AI Subtitle & Translation Studio</span>
          </div>

          <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Upload Video or Paste YouTube URL for{' '}
            <span className="bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-400 bg-clip-text text-transparent">
              Live Synchronized Subtitles
            </span>
          </h2>
          <p className="mt-2 max-w-xl text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            Select any local video file or enter a YouTube URL to play it with synchronized subtitles, multilingual AI translation
            (Telugu, Hindi, Chinese, Korean, English), and full CC controls.
          </p>

          {/* Mode Tabs: Upload vs YouTube */}
          <div className="mt-6 flex items-center rounded-2xl border border-slate-200/80 bg-slate-100/70 p-1 dark:border-slate-800 dark:bg-slate-950/60">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'upload'
                  ? 'bg-white text-teal-700 shadow-sm dark:bg-slate-800 dark:text-teal-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Film className="h-4 w-4" />
              <span>Upload Video File</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('youtube')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'youtube'
                  ? 'bg-white text-teal-700 shadow-sm dark:bg-slate-800 dark:text-teal-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Youtube className="h-4 w-4 text-red-500" />
              <span>YouTube URL Import</span>
            </button>
          </div>

          {/* Tab 1: Upload Video Box */}
          {activeTab === 'upload' && (
            <div className="mt-6 w-full max-w-xl">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-teal-500/40 bg-teal-50/20 p-8 transition-all duration-300 hover:border-teal-500 hover:bg-teal-50/40 hover:shadow-glow-sm dark:border-teal-500/30 dark:bg-teal-950/10 dark:hover:border-teal-400 dark:hover:bg-teal-950/25"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-500 text-white shadow-md transition-transform duration-300 group-hover:scale-110">
                  <Upload className="h-8 w-8" />
                </div>

                <p className="mt-4 text-base font-bold text-slate-800 dark:text-slate-100">
                  Click to select a video from your computer
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Supported formats: <span className="font-semibold text-slate-600 dark:text-slate-300">MP4, WebM, OGG, MOV, MKV</span>
                </p>

                {/* Primary Upload Video Button */}
                <button
                  type="button"
                  data-testid="upload-video-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="mt-5 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 px-7 py-3 text-sm font-bold text-white shadow-md transition hover:from-teal-500 hover:to-cyan-500 hover:shadow-glow-sm"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload Video</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: YouTube URL Input */}
          {activeTab === 'youtube' && (
            <div className="mt-6 w-full max-w-xl space-y-3">
              <div className="relative flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Youtube className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-red-500" />
                  <input
                    type="text"
                    value={youtubeInput}
                    onChange={(e) => setYoutubeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLoadYoutube();
                    }}
                    placeholder="Paste YouTube link (e.g. https://www.youtube.com/watch?v=...)"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950/60 dark:text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleLoadYoutube}
                  disabled={isLoadingYoutube || !youtubeInput.trim()}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-500 disabled:opacity-50"
                >
                  {isLoadingYoutube ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                  <span>{isLoadingYoutube ? 'Loading…' : 'Load Video'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                YouTube transcripts are parsed automatically into synchronized cues with full multi-language translation.
              </p>
            </div>
          )}

          {/* Error Message for unsupported files or missing captions */}
          {uploadError && (
            <div className="mt-5 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50/90 p-4 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      )}

      {/* ── 2. AFTER VIDEO IS SELECTED (Player & Subtitle Controls) ───────── */}
      {videoSource && (
        <div className="space-y-6">
          {/* Top Bar: Video Title & Reset Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
                <Film className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                  {videoSource.name}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Video Loaded & Ready
                  </span>
                  <span>&bull;</span>
                  <span>
                    Source: <strong className="text-slate-700 dark:text-slate-300">{sourceLanguage}</strong>
                  </span>
                  <span>&bull;</span>
                  <span>
                    Active Subtitles: <strong className="text-teal-600 dark:text-teal-400">{activeLanguage}</strong>
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Change Video</span>
            </button>
          </div>

          {/* Video Player Container */}
          <div className="relative aspect-video w-full overflow-hidden rounded-3xl bg-slate-950 shadow-2xl ring-1 ring-slate-800">
            {videoSource.type === 'upload' ? (
              <video
                ref={videoRef}
                src={videoSource.url}
                controls
                playsInline
                onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
                onTimeUpdate={handleTimeUpdate}
                onSeeked={handleTimeUpdate}
                onPlay={handleTimeUpdate}
                onPause={handleTimeUpdate}
                className="h-full w-full object-contain"
              />
            ) : (
              <iframe
                id="youtube-studio-player"
                src={videoSource.url}
                title="YouTube Video Player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full border-0"
              />
            )}

            {/* If video creator disabled embedded playback on third-party websites */}
            {videoSource.type === 'youtube' && isEmbedRestricted && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-between bg-gradient-to-b from-slate-950/95 via-slate-900/90 to-slate-950/95 p-4 sm:p-6 text-white backdrop-blur-xs">
                <div className="w-full max-w-lg text-center pt-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Embedded Playback Disabled by Creator
                  </div>
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                    The owner of this video restricts video stream playback exclusively to YouTube.
                    Your full dialogue transcript, translations, synopsis, and PDFs are ready below.
                  </p>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <a
                    href={`https://www.youtube.com/watch?v=${currentYouTubeId || 'watch'}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg transition hover:bg-red-500 active:scale-95"
                  >
                    <Play className="h-4 w-4 fill-white" />
                    Watch Video on YouTube ↗
                  </a>
                  <span className="text-[11px] text-slate-400">
                    Opens in a new tab • Use controls below to follow synchronized subtitles
                  </span>
                </div>

                <div className="w-full max-w-xl rounded-2xl border border-slate-700/80 bg-slate-800/90 p-3 sm:p-4 shadow-xl backdrop-blur-md mb-2">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsPlayingSimulation(!isPlayingSimulation)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500 text-slate-950 font-bold transition hover:bg-teal-400 active:scale-95"
                      title={isPlayingSimulation ? 'Pause Subtitles' : 'Play & Follow Subtitles'}
                    >
                      {isPlayingSimulation ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
                    </button>

                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex justify-between text-[11px] font-mono text-slate-300">
                        <span>{formatTime(currentTime)}</span>
                        <span className="font-sans text-[11px] text-teal-300 font-semibold">
                          {isPlayingSimulation ? 'Playing Subtitles...' : 'Subtitle Player'}
                        </span>
                        <span>{formatTime(effectiveDuration)}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={effectiveDuration || 60}
                        step={0.1}
                        value={currentTime}
                        onChange={(e) => handleSeek(parseFloat(e.target.value))}
                        className="w-full accent-teal-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Synchronized Subtitle Overlay (Cleanly positioned above bottom player controls) */}
            {isCcOn && activeCue && (
              <div
                data-testid="subtitle-overlay"
                className="pointer-events-none absolute bottom-12 sm:bottom-14 left-0 right-0 z-30 flex justify-center px-4"
              >
                <div className="max-w-[85%] rounded-2xl border border-white/20 bg-black/85 px-6 py-2.5 text-center text-sm font-bold text-white shadow-2xl backdrop-blur-md sm:text-base leading-snug animate-in fade-in duration-150">
                  {decodeHtmlEntities(activeCue.text)}
                </div>
              </div>
            )}

            {/* Subtitles Hidden (CC OFF) Badge Notice */}
            {!isCcOn && (
              <div className="pointer-events-none absolute top-4 right-4 z-20 rounded-lg bg-black/70 px-2.5 py-1 text-[11px] font-bold text-slate-300 backdrop-blur">
                CC OFF (Subtitles Muted)
              </div>
            )}

            {/* Loading Indicator Overlay during Transcription */}
            {isTranscribing && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/60 p-4 text-center backdrop-blur-xs">
                <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
                <p className="mt-3 text-sm font-bold text-white">Transcribing video audio...</p>
                <p className="mt-1 text-xs text-teal-200">Generating synchronized timestamp cues</p>
              </div>
            )}
          </div>

          {/* ── Subtitle Controls Panel (Neatly organized near the video player) ── */}
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Left: Language Selection & Translate Button */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
                    <Languages className="h-4 w-4" />
                  </span>
                  <label htmlFor="subtitle-language-select" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Subtitle Language:
                  </label>
                </div>

                {/* Subtitle Language Dropdown (Selecting alone does NOT trigger translation) */}
                <select
                  id="subtitle-language-select"
                  data-testid="language-select"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  disabled={isTranscribing || isLoadingYoutube}
                  className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-800 shadow-xs outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {(!selectedLanguage || isTranscribing || isLoadingYoutube) && (
                    <option value="" disabled>
                      Detecting original language...
                    </option>
                  )}
                  {availableLanguages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>

                {/* Translate Button */}
                <button
                  type="button"
                  data-testid="translate-button"
                  onClick={handleTranslate}
                  disabled={isTranslating || isTranscribing}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-5 py-2 text-xs sm:text-sm font-bold text-white shadow-sm transition hover:from-teal-500 hover:to-cyan-500 hover:shadow-glow-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isTranslating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Translating to {selectedLanguage}…</span>
                    </>
                  ) : (
                    <>
                      <Languages className="h-4 w-4" />
                      <span>Translate Subtitles</span>
                    </>
                  )}
                </button>
              </div>

              {/* Right: CC Button (Toggle Subtitles ON/OFF) & Subtitle Downloads */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="cc-button"
                  onClick={() => setIsCcOn((prev) => !prev)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs sm:text-sm font-extrabold transition-all duration-200 ${
                    isCcOn
                      ? 'border-teal-500 bg-teal-500 text-white shadow-glow-sm'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                  aria-pressed={isCcOn}
                  title={isCcOn ? 'Turn Subtitles OFF' : 'Turn Subtitles ON'}
                >
                  <Subtitles className="h-4 w-4" />
                  <span>CC {isCcOn ? 'ON' : 'OFF'}</span>
                </button>

                {/* Subtitle Downloads (SRT / VTT / TXT) */}
                {currentCues.length > 0 && (
                  <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        const srt = cuesToSrt(currentCues);
                        triggerDownload(
                          srt,
                          `${videoSource?.name || 'subtitles'}_${activeLanguage}.srt`,
                          'text/plain;charset=utf-8'
                        );
                      }}
                      className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      title="Download as SubRip (.srt)"
                    >
                      <FileDown className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                      <span>SRT</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const vtt = cuesToVtt(currentCues);
                        triggerDownload(
                          vtt,
                          `${videoSource?.name || 'subtitles'}_${activeLanguage}.vtt`,
                          'text/vtt;charset=utf-8'
                        );
                      }}
                      className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      title="Download as WebVTT (.vtt)"
                    >
                      <FileDown className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                      <span>VTT</span>
                    </button>
                    {/* Separate PDF Button 1: Executive Synopsis PDF (Without Transcript) */}
                    <button
                      type="button"
                      data-testid="export-synopsis-pdf-button"
                      onClick={handleDownloadPdfSynopsis}
                      disabled={isGeneratingSynopsis}
                      className="flex items-center gap-1.5 rounded-xl border border-teal-500/40 bg-teal-50/80 px-3 py-2 text-xs font-bold text-teal-800 shadow-2xs transition hover:bg-teal-100 dark:border-teal-600/50 dark:bg-teal-950/60 dark:text-teal-200 dark:hover:bg-teal-900/60 disabled:opacity-50"
                      title="Download 11-Section Executive Synopsis PDF in Original Language (Without Transcript)"
                    >
                      {isGeneratingSynopsis ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-600 dark:text-teal-400" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                      )}
                      <span>{isGeneratingSynopsis ? 'Generating Synopsis…' : 'Synopsis PDF'}</span>
                    </button>

                    {/* Separate PDF Button 2: Chronological Transcript PDF (Without Synopsis) */}
                    <button
                      type="button"
                      data-testid="export-transcript-pdf-button"
                      onClick={handleDownloadPdfTranscript}
                      disabled={isGeneratingTranscript}
                      className="flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-50/80 px-3 py-2 text-xs font-bold text-cyan-800 shadow-2xs transition hover:bg-cyan-100 dark:border-cyan-600/50 dark:bg-cyan-950/60 dark:text-cyan-200 dark:hover:bg-cyan-900/60 disabled:opacity-50"
                      title="Download Complete Chronological Transcript PDF in Original Language & Code-Switching (Without Synopsis)"
                    >
                      {isGeneratingTranscript ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-600 dark:text-cyan-400" />
                      ) : (
                        <FileDown className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                      )}
                      <span>{isGeneratingTranscript ? 'Generating Transcript…' : 'Transcript PDF'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Translation / Transcription Error Banner */}
            {translationError && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50/90 p-3 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{translationError}</span>
                </div>
                {videoSource?.type === 'upload' && videoSource.file && currentCues.length === 0 && (
                  <button
                    type="button"
                    onClick={() => triggerTranscription(videoSource.file!)}
                    disabled={isTranscribing}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs transition hover:bg-red-500 disabled:opacity-50"
                  >
                    {isTranscribing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    <span>Retry Transcription</span>
                  </button>
                )}
              </div>
            )}

            {/* Live Subtitle Status Summary */}
            <div className="flex flex-wrap items-center justify-between border-t border-slate-200/60 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Active Subtitle Track:</span>
                <span className="rounded-md bg-teal-50 px-2 py-0.5 font-bold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                  {activeLanguage}
                </span>
                <span className="text-[11px]">({currentCues.length} synchronized cues)</span>
              </div>

              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span>Playback: {formatTime(currentTime)}</span>
                <span>&bull;</span>
                <span>
                  CC State:{' '}
                  <strong className={isCcOn ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}>
                    {isCcOn ? 'ENABLED' : 'MUTED'}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* ── VIDEO SYNOPSIS & CONTENT INTELLIGENCE SUITE ────────────────────── */}
          {videoSource && (
            <div className="space-y-5">
              {/* ── Top Overview & Details Card ── */}
              <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/70">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-sky-600 text-[11px] font-extrabold text-white">
                      2
                    </span>
                    <Film className="h-4 w-4 text-teal-500" />
                    <span>Video Overview / Video Details</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400">English</span>
                    {isGeneratingSynopsis && (
                      <span className="flex items-center gap-1.5 rounded-md bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Analyzing speech...</span>
                      </span>
                    )}
                    <button
                      onClick={handleGenerateSynopsis}
                      disabled={isGeneratingSynopsis}
                      title="Re-run AI synopsis generation"
                      className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750"
                    >
                      <RotateCcw className={`h-3 w-3 ${isGeneratingSynopsis ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                    <span className="rounded-md bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                      Original: {original_language}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-3">
                  <div className="rounded-xl border border-slate-200/60 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Title / Subject</span>
                    <p className="mt-1 font-bold text-slate-800 dark:text-slate-100 line-clamp-1">{videoSource.name}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/60 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Original Spoken Language</span>
                    <p className="mt-1 font-bold text-teal-600 dark:text-teal-400">{original_language}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/60 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Dialogue Cues</span>
                    <p className="mt-1 font-bold text-slate-800 dark:text-slate-100">
                      {original_transcript.length || original_subtitles.length} segments
                    </p>
                  </div>
                </div>

                {(original_synopsis?.videoOverview || original_synopsis?.overview) && (
                  <div className="rounded-xl border border-slate-200/60 bg-slate-50/60 p-3.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300 leading-relaxed">
                    {decodeHtmlEntities(original_synopsis.videoOverview || original_synopsis.overview || '')}
                  </div>
                )}
              </div>

              {/* Generating Synopsis Loader Notice */}
              {isGeneratingSynopsis && !original_synopsis && (
                <div className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-teal-500/30 bg-teal-50/40 p-6 text-center dark:border-teal-500/20 dark:bg-teal-950/20 animate-pulse">
                  <Loader2 className="h-6 w-6 animate-spin text-teal-600 dark:text-teal-400" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Generating Complete Synopsis...
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Extracting English executive summary, detailed synopsis, key topics, outcomes, and original spoken dialogue.
                    </p>
                  </div>
                </div>
              )}

              {/* If no synopsis loaded and not currently generating */}
              {!original_synopsis && !isGeneratingSynopsis && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-6 text-center dark:border-slate-800 dark:bg-slate-900/70">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Extract English executive summary, detailed synopsis, key topics, outcomes, and original spoken dialogue.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateSynopsis}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:from-teal-500 hover:to-cyan-500"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Generate Video Synopsis</span>
                  </button>
                </div>
              )}

              {/* ── 1. Executive Summary (ALWAYS IN ENGLISH) ── */}
              {original_synopsis && (
                <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-teal-600 text-[11px] font-extrabold text-white">
                        1
                      </span>
                      <Sparkles className="h-3.5 w-3.5 text-teal-500" />
                      <span>Executive Summary</span>
                    </h3>
                    <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400">English</span>
                  </div>
                  <div className="rounded-xl border border-teal-500/20 bg-teal-50/50 p-4 text-xs font-medium text-teal-950 leading-relaxed dark:bg-teal-950/30 dark:text-teal-200">
                    {decodeHtmlEntities(original_synopsis.executiveSummary || original_synopsis.overview || '')}
                  </div>
                </div>
              )}

              {/* ── 3. Detailed Synopsis (ALWAYS IN ENGLISH) ── */}
              {original_synopsis?.detailedSynopsis && (
                <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-sky-600 text-[11px] font-extrabold text-white">
                        3
                      </span>
                      <BookOpen className="h-3.5 w-3.5 text-sky-500" />
                      <span>Detailed Synopsis</span>
                    </h3>
                    <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400">English</span>
                  </div>
                  <div className="rounded-xl border border-slate-200/60 bg-slate-50/60 p-4 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                    {decodeHtmlEntities(original_synopsis.detailedSynopsis)}
                  </div>
                </div>
              )}

              {/* ── 4. Key Topics Covered (ALWAYS IN ENGLISH) ── */}
              {original_synopsis && (original_synopsis.keyTopicsCovered || original_synopsis.keyTopics) && (
                <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-teal-600 text-[11px] font-extrabold text-white">
                        4
                      </span>
                      <ListChecks className="h-3.5 w-3.5 text-teal-500" />
                      <span>Key Topics Covered</span>
                    </h3>
                    <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400">English</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(original_synopsis.keyTopicsCovered || original_synopsis.keyTopics || []).map((top: any, idx: number) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200/60 bg-slate-50/60 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-950/40"
                      >
                        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-1.5">
                          <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0" />
                          <span>{decodeHtmlEntities(top.topic)}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed pl-4 text-[11.5px]">
                          {decodeHtmlEntities(top.summary)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 5. Key Moments & Timeline (ORIGINAL SPOKEN LANGUAGE) ── */}
              {original_synopsis && (original_synopsis.keyMomentsTimeline || original_synopsis.keyMoments) && (
                <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-teal-600 text-[11px] font-extrabold text-white">
                        5
                      </span>
                      <Clock className="h-3.5 w-3.5 text-teal-500" />
                      <span>Key Moments & Timeline</span>
                    </h3>
                    <span className="text-[11px] text-slate-400">Original Dialogue ({original_language})</span>
                  </div>
                  <div className="space-y-2">
                    {(original_synopsis.keyMomentsTimeline || original_synopsis.keyMoments || []).map((moment: any, idx: number) => {
                      const timeSec = parseTimestampToSeconds(moment.timestamp);
                      const speakerLabel = normalizeSpeakerLabel(moment.speaker, (idx % 2) + 1);
                      return (
                        <div
                          key={idx}
                          onClick={() => handleSeek(timeSec)}
                          className="group flex items-start gap-3 rounded-xl border border-slate-200/60 bg-slate-50/60 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950/40 text-slate-700 dark:text-slate-200 cursor-pointer hover:border-teal-500/50 hover:bg-teal-50/40 dark:hover:bg-teal-950/20 transition"
                        >
                          <span className="font-mono font-bold text-teal-600 dark:text-teal-400 shrink-0 group-hover:underline">
                            {moment.timestamp || '[00:00]'}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white shrink-0 min-w-[75px]">
                            {decodeHtmlEntities(speakerLabel)}:
                          </span>
                          <span className="flex-1 leading-relaxed text-slate-600 dark:text-slate-300">
                            {decodeHtmlEntities(moment.dialogueOrEvent || moment.description || '')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── 6. Characters / Speakers & Dialogue (ORIGINAL SPOKEN LANGUAGE) ── */}
              <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/70">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-sky-600 text-[11px] font-extrabold text-white">
                      6
                    </span>
                    <Users className="h-3.5 w-3.5 text-sky-500" />
                    <span>Characters / Speakers & Dialogue</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    English Labels &bull; Original Dialogue ({original_language})
                  </span>
                </div>

                {original_synopsis?.charactersSpeakersDialogue && original_synopsis.charactersSpeakersDialogue.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    {original_synopsis.charactersSpeakersDialogue.map((char: any, idx: number) => {
                      const speakerLabel = normalizeSpeakerLabel(char.speaker, (idx % 2) + 1);
                      return (
                        <div
                          key={idx}
                          className="rounded-xl border border-slate-200/60 bg-slate-50/60 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/40"
                        >
                          <div className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-sky-500" />
                            <span>{decodeHtmlEntities(speakerLabel)}</span>
                          </div>
                          <div className="text-slate-600 dark:text-slate-300 italic leading-relaxed pl-5 text-[11.5px]">
                            &ldquo;{decodeHtmlEntities(char.dialogue)}&rdquo;
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Synchronized Transcript Timeline (All spoken dialogue cues in original language) */}
                <div className="mt-3 border-t border-slate-200/60 dark:border-slate-800 pt-3">
                  <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold uppercase tracking-wider">Synchronized Transcript Timeline</span>
                    <span>Click any line to seek video</span>
                  </div>
                  <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
                    {(original_transcript.length > 0 ? original_transcript : original_subtitles).map((cue, idx) => {
                      const speakerLabel = normalizeSpeakerLabel(cue.speaker, (idx % 2) + 1);
                      const isCurrentlyPlaying = currentTime >= cue.start && currentTime <= cue.end;
                      return (
                        <div
                          key={cue.id}
                          onClick={() => handleSeek(cue.start)}
                          className={`flex items-start gap-3 rounded-xl border p-2 text-xs cursor-pointer transition ${
                            isCurrentlyPlaying
                              ? 'border-teal-500 bg-teal-500/10 text-teal-900 dark:text-teal-200 font-medium'
                              : 'border-slate-200/60 bg-slate-50/50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300 hover:border-teal-500/40 hover:bg-teal-50/30 dark:hover:bg-teal-950/20'
                          }`}
                        >
                          <span className="font-mono font-bold text-teal-600 dark:text-teal-400 shrink-0">
                            [{formatTime(cue.start)}]
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white shrink-0 min-w-[70px]">
                            {speakerLabel}:
                          </span>
                          <span className="flex-1 leading-relaxed">
                            {decodeHtmlEntities(cue.text)}
                          </span>
                          {isCurrentlyPlaying && (
                            <span className="rounded bg-teal-500/20 px-1.5 py-0.5 text-[10px] font-bold text-teal-600 dark:text-teal-400">
                              PLAYING
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── 7. Outcomes & Conclusions (ALWAYS IN ENGLISH) ── */}
              {original_synopsis && (original_synopsis.outcomesAndConclusions || original_synopsis.conclusion) && (
                <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-teal-600 text-[11px] font-extrabold text-white">
                        7
                      </span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-teal-500" />
                      <span>Outcomes & Conclusions</span>
                    </h3>
                    <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400">English</span>
                  </div>
                  <div className="rounded-xl border border-teal-500/20 bg-teal-50/50 p-4 text-xs font-medium text-teal-950 leading-relaxed dark:bg-teal-950/30 dark:text-teal-200">
                    {decodeHtmlEntities(original_synopsis.outcomesAndConclusions || original_synopsis.conclusion || '')}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
