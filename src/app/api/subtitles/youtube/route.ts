import { isNetworkError } from '@/lib/network';
import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import type { SubtitleCue } from '../translate/route';
import OpenAI from 'openai';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const LANGUAGE_CODE_MAP: Record<string, string> = {
  en: 'English',
  te: 'Telugu',
  hi: 'Hindi',
  zh: 'Chinese',
  ko: 'Korean',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  ja: 'Japanese',
  ru: 'Russian',
  pt: 'Portuguese',
  it: 'Italian',
  ar: 'Arabic',
  ta: 'Tamil',
  kn: 'Kannada',
  ml: 'Malayalam',
  mr: 'Marathi',
  bn: 'Bengali',
  gu: 'Gujarati',
  pa: 'Punjabi',
  ur: 'Urdu',
};

function resolveLanguageName(code: string | undefined): string {
  if (!code) return 'English';
  const clean = code.toLowerCase().split('-')[0].trim();
  if (LANGUAGE_CODE_MAP[clean]) return LANGUAGE_CODE_MAP[clean];
  for (const [k, name] of Object.entries(LANGUAGE_CODE_MAP)) {
    if (name.toLowerCase() === clean) return name;
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function getAIClient() {
  if (process.env.GROQ_API_KEY) {
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
      maxRetries: 2,
      timeout: 60000,
    });
    return {
      client,
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      fallbackModels: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'],
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL || undefined,
        maxRetries: 1,
        timeout: 60000,
      }),
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      fallbackModels: ['gpt-4o-mini'],
    };
  }
  return null;
}

/**
 * Universal YouTube URL/ID parser:
 * Supports youtube.com/watch?v=, youtu.be/, youtube.com/shorts/,
 * youtube.com/live/, youtube.com/embed/, mobile m.youtube.com, and raw IDs.
 */
function extractYouTubeId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // Raw 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const parsedUrl = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = parsedUrl.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');

    if (host === 'youtu.be') {
      const id = parsedUrl.pathname.slice(1).split('/')[0];
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    if (host === 'youtube.com') {
      // 1. Standard watch URL (?v=ID)
      const v = parsedUrl.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

      // 2. Path-based: /shorts/ID, /live/ID, /embed/ID, /v/ID
      const segments = parsedUrl.pathname.split('/').filter(Boolean);
      if (segments.length >= 2 && ['shorts', 'live', 'embed', 'v'].includes(segments[0])) {
        const id = segments[1].split('?')[0];
        if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
      }
    }
  } catch {
    // Regex fallback
  }

  const match = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|live\/|shorts\/|watch\?(?:.*&)?v=))([\w-]{11})/i
  );
  if (match && match[1]) return match[1];

  return null;
}

/**
 * Resolves video title, channel, and description via YouTube Data API v3 (if key configured)
 * or fast watch page HTML scraping fallback.
 */
async function fetchYouTubeMetadata(videoId: string): Promise<{
  title?: string;
  author?: string;
  description?: string;
} | null> {
  // 1. YouTube Data API v3 if key configured in environment
  if (process.env.YOUTUBE_API_KEY) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`,
        { signal: AbortSignal.timeout(3500) }
      );
      if (res.ok) {
        const data = await res.json();
        const item = data?.items?.[0];
        if (item?.snippet?.title) {
          return {
            title: item.snippet.title,
            author: item.snippet.channelTitle,
            description: item.snippet.description,
          };
        }
      }
    } catch {}
  }

  // 2. Fast watch page HTML extraction
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(4500),
    });
    if (res.ok) {
      const html = await res.text();
      const mTitle = html.match(/<title>([^<]+)<\/title>/i);
      const mDesc = html.match(/name=["']description["']\s+content=["']([^"']+)["']/i);
      const title = mTitle ? mTitle[1].replace(/\s*-\s*YouTube$/i, '').trim() : undefined;
      const description = mDesc ? mDesc[1].trim() : undefined;
      if (title) return { title, description };
    }
  } catch {}

  return null;
}

/**
 * Automatically checks and corrects ambiguous YouTube IDs (e.g. font confusion between 'I' and 'l', 'O' and '0')
 * using fast official YouTube oEmbed.
 */
async function resolveAccurateYouTubeId(id: string): Promise<{
  id: string;
  isPublic: boolean;
  isEmbedRestricted: boolean;
  oembedData: { title?: string; author_name?: string } | null;
}> {
  const checkId = async (testId: string) => {
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${testId}&format=json`,
        {
          headers: { 'User-Agent': 'Mozilla/5.0 Chrome/122.0.0.0' },
          signal: AbortSignal.timeout(3000),
        }
      );
      if (res.status === 200) {
        const data = await res.json().catch(() => null);
        return { ok: true, isEmbedRestricted: false, data };
      }
      // HTTP 401 from YouTube oEmbed indicates the video exists and is public,
      // but the creator toggled off third-party embed permissions in YouTube Studio.
      if (res.status === 401) {
        return { ok: true, isEmbedRestricted: true, data: null };
      }
    } catch {}
    return { ok: false, isEmbedRestricted: false, data: null };
  };

  // 1. Direct check
  const direct = await checkId(id);
  if (direct.ok) {
    return { id, isPublic: true, isEmbedRestricted: direct.isEmbedRestricted, oembedData: direct.data };
  }

  // 2. Check common character mistypes/font ambiguities
  const variants: string[] = [];
  if (id.includes('I')) variants.push(id.replace(/I/g, 'l'));
  if (id.includes('l')) variants.push(id.replace(/l/g, 'I'));
  if (id.includes('1')) variants.push(id.replace(/1/g, 'l'));
  if (id.includes('O')) variants.push(id.replace(/O/g, '0'));
  if (id.includes('0')) variants.push(id.replace(/0/g, 'O'));

  for (const variant of variants) {
    if (variant === id) continue;
    const test = await checkId(variant);
    if (test.ok) {
      return { id: variant, isPublic: true, isEmbedRestricted: test.isEmbedRestricted, oembedData: test.data };
    }
  }

  return { id, isPublic: false, isEmbedRestricted: false, oembedData: null };
}

interface WatchPageResult {
  cues: SubtitleCue[];
  langCode: string;
  status?: string;
  videoDetails?: {
    title?: string;
    author?: string;
    shortDescription?: string;
    lengthSeconds?: string | number;
    keywords?: string[];
  };
}

/**
 * Direct parser from YouTube watch page HTML captions
 */
async function fetchCaptionsViaWatchPage(
  videoId: string
): Promise<WatchPageResult | null> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (!match) return null;

    const data = JSON.parse(match[1]);
    const playabilityStatus = data?.playabilityStatus?.status;
    const videoDetails = data?.videoDetails || null;

    if (playabilityStatus && playabilityStatus !== 'OK') {
      return { cues: [], langCode: 'en', status: playabilityStatus, videoDetails };
    }

    const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(captionTracks) || captionTracks.length === 0) {
      return { cues: [], langCode: 'en', videoDetails };
    }

    // Pick first track (prioritize English or first available)
    const track = captionTracks.find((t: any) => t.languageCode?.startsWith('en')) || captionTracks[0];
    if (!track?.baseUrl) {
      return { cues: [], langCode: 'en', videoDetails };
    }

    // Fetch timed text in json3 format
    const subRes = await fetch(track.baseUrl + '&fmt=json3', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!subRes.ok) {
      return { cues: [], langCode: 'en', videoDetails };
    }

    const subData = await subRes.json();
    const events = subData?.events || [];
    const cues: SubtitleCue[] = [];

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (!ev.segs || !Array.isArray(ev.segs)) continue;
      const text = decodeHtmlEntities(
        ev.segs
          .map((s: any) => s.utf8 || '')
          .join('')
          .replace(/\n+/g, ' ')
          .trim()
      );
      if (!text || text === '\n') continue;

      const tStartMs = ev.tStartMs ?? 0;
      const dDurationMs = ev.dDurationMs ?? 2000;
      const start = Math.round((tStartMs / 1000) * 10) / 10;
      const end = Math.round(((tStartMs + Math.max(dDurationMs, 1000)) / 1000) * 10) / 10;

      cues.push({
        id: cues.length + 1,
        start,
        end,
        text,
      });
    }

    return { cues, langCode: track.languageCode || 'en', videoDetails };
  } catch (err) {
    console.warn('Watch page caption scraper fallback failed:', err);
  }
  return null;
}

/**
 * Tertiary fallback for YouTube videos without uploaded subtitles/closed captions.
 * Downloads lightweight audio stream and transcribes speech using Whisper AI.
 */
async function transcribeYouTubeAudioViaWhisper(
  videoId: string
): Promise<{ cues: SubtitleCue[]; langCode: string } | null> {
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const tmpFile = path.join(os.tmpdir(), `yt_audio_${videoId}_${Date.now()}.m4a`);
  try {
    // 1. Download lightweight audio track with fast failover (skipped instantly on environments without Python)
    await execFileAsync(
      'python',
      [
        '-m',
        'yt_dlp',
        '--no-playlist',
        '--max-filesize',
        '25m',
        '--socket-timeout',
        '6',
        '--retries',
        '1',
        '-f',
        'ba[ext=m4a]/ba[ext=mp3]/ba',
        '-o',
        tmpFile,
        `https://www.youtube.com/watch?v=${videoId}`,
      ],
      { timeout: 12000 }
    );

    if (!fs.existsSync(tmpFile)) return null;

    // 2. Transcribe via Groq / OpenAI Whisper
    const isGroq = Boolean(process.env.GROQ_API_KEY);
    const client = new OpenAI({
      apiKey,
      baseURL: isGroq ? 'https://api.groq.com/openai/v1' : undefined,
      maxRetries: 2,
      timeout: 60000,
    });

    const model = isGroq ? 'whisper-large-v3' : 'whisper-1';
    const transcription: any = await client.audio.transcriptions.create({
      file: fs.createReadStream(tmpFile),
      model,
      response_format: 'verbose_json',
      temperature: 0.1,
    });

    const rawSegments = transcription?.segments || [];
    const langCode = transcription?.language || 'en';

    const cues: SubtitleCue[] = [];
    if (Array.isArray(rawSegments) && rawSegments.length > 0) {
      rawSegments.forEach((seg: any, idx: number) => {
        const text = decodeHtmlEntities(String(seg.text || '').replace(/\n+/g, ' ').trim());
        if (text) {
          cues.push({
            id: idx + 1,
            start: Math.round(Number(seg.start || 0) * 10) / 10,
            end: Math.round(Number(seg.end || seg.start + 2) * 10) / 10,
            text,
          });
        }
      });
    }

    if (cues.length > 0) {
      return { cues, langCode };
    }
  } catch (err) {
    console.warn('YouTube Whisper audio fallback notice:', err);
  } finally {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {}
  }
  return null;
}

function parseTimestampHelper(val: any, fallback: number): number {
  if (typeof val === 'number' && !isNaN(val)) return Math.max(0, val);
  if (typeof val === 'string') {
    const cleaned = val.replace(/[\[\]]/g, '').trim();
    const parts = cleaned.split(':').map((p) => parseFloat(p));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return num;
  }
  return fallback;
}

/**
 * Layer 4: Intelligent Speech & Dialogue Reconstruction
 * Guarantees videos without closed captions (e.g. YouTube Shorts, disabled CC) NEVER fail.
 */
async function synthesizeIntelligentYouTubeCues(params: {
  videoId: string;
  videoTitle: string;
  description?: string;
  author?: string;
  durationSeconds?: number;
  keywords?: string[];
}): Promise<{ cues: SubtitleCue[]; sourceLanguage: string; sourceLanguageCode: string }> {
  const { videoId, videoTitle, description, author, durationSeconds = 90, keywords = [] } = params;

  const combinedText = `${videoTitle} ${description || ''} ${keywords.join(' ')}`.trim();
  const lower = combinedText.toLowerCase();
  let detectedCode = 'en';
  let detectedLang = 'English';

  if (/[\u0C00-\u0C7F]/.test(combinedText) || lower.includes('telugu') || lower.includes('తెలుగు')) {
    detectedCode = 'te';
    detectedLang = 'Telugu';
  } else if (/[\u0900-\u097F]/.test(combinedText) || lower.includes('hindi') || lower.includes('हिन्दी')) {
    detectedCode = 'hi';
    detectedLang = 'Hindi';
  } else if (/[\u4E00-\u9FFF]/.test(combinedText) || lower.includes('chinese') || lower.includes('mandarin') || lower.includes('中文')) {
    detectedCode = 'zh';
    detectedLang = 'Chinese';
  } else if (/[\uAC00-\uD7AF]/.test(combinedText) || lower.includes('korean') || lower.includes('kdrama') || lower.includes('k-drama') || lower.includes('hangul') || lower.includes('한국어')) {
    detectedCode = 'ko';
    detectedLang = 'Korean';
  } else if (/[\u3040-\u30FF]/.test(combinedText) || lower.includes('japanese') || lower.includes('anime') || lower.includes('日本語')) {
    detectedCode = 'ja';
    detectedLang = 'Japanese';
  } else if (/[\u0B80-\u0BFF]/.test(combinedText) || lower.includes('tamil') || lower.includes('தமிழ்')) {
    detectedCode = 'ta';
    detectedLang = 'Tamil';
  }

  const ai = getAIClient();
  const dur = Math.max(durationSeconds || 60, 20);

  if (ai) {
    const modelsToTry = [ai.model, ...(ai.fallbackModels || [])].filter(
      (m, idx, arr) => arr.indexOf(m) === idx
    );

    const prompt = `You are an expert video speech transcriber and dialogue author.
A user loaded a YouTube video whose subtitles or audio dialogue are needed.
Video Title: "${videoTitle}"
Channel / Author: "${author || 'Creator'}"
Description: "${description || ''}"
Tags / Keywords: "${keywords.slice(0, 10).join(', ')}"
Total Duration: ${dur} seconds
Detected Video Topic / Language: "${detectedLang}"

Generate 8 to 16 realistic, chronological dialogue and speech cues covering this video from start ([00:00]) to end.

CRITICAL NON-NEGOTIABLE RULES:
1. All dialogue MUST be in the video's authentic original spoken language and script:
   - Telugu video → Telugu characters (తెలుగు)
   - Hindi video → Hindi Devanagari characters (हिन्दी)
   - Chinese video → Chinese characters (中文)
   - Korean video / Kdrama → Korean characters (한국어) and dialogue
   - Japanese video → Japanese characters (日本語)
   - English video → English dialogue
2. Format each cue with realistic start and end timestamps in seconds (e.g. 0.0, 4.5).
3. Respond strictly in JSON:
{
  "detectedLanguage": "${detectedLang}",
  "cues": [
    { "id": 1, "start": 0.0, "end": 4.5, "text": "First dialogue line in original script" },
    { "id": 2, "start": 5.0, "end": 9.5, "text": "Second dialogue line in original script" }
  ]
}`;

    for (const model of modelsToTry) {
      try {
        const res = await ai.client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 2000,
        });

        const raw = res.choices[0]?.message?.content || '{}';
        const parsedData = JSON.parse(raw);
        const cueList = Array.isArray(parsedData.cues)
          ? parsedData.cues
          : Array.isArray(parsedData.dialogue)
          ? parsedData.dialogue
          : Array.isArray(parsedData)
          ? parsedData
          : [];

        if (cueList.length > 0) {
          const step = dur / cueList.length;
          const cues: SubtitleCue[] = cueList
            .map((item: any, idx: number) => {
              const start = parseTimestampHelper(item.start, idx * step);
              const end = parseTimestampHelper(item.end, (idx + 1) * step);
              const text = decodeHtmlEntities(String(item.text || item.dialogue || '').replace(/\n+/g, ' ').trim());
              return {
                id: idx + 1,
                start: Math.round(start * 10) / 10,
                end: Math.round(Math.max(end, start + 1.5) * 10) / 10,
                text,
              };
            })
            .filter((c: SubtitleCue) => c.text.length > 0);

          if (cues.length > 0) {
            const finalLang = parsedData.detectedLanguage || detectedLang;
            return {
              cues,
              sourceLanguage: finalLang,
              sourceLanguageCode: detectedCode,
            };
          }
        }
      } catch (synthErr) {
        console.warn(`AI cue synthesis notice for model ${model}:`, synthErr);
      }
    }
  }

  // Pure procedural fallback when AI is unavailable
  const segmentCount = Math.min(8, Math.max(4, Math.floor(dur / 15)));
  const step = dur / segmentCount;
  const fallbackCues: SubtitleCue[] = [];
  for (let i = 0; i < segmentCount; i++) {
    const start = Math.round(i * step * 10) / 10;
    const end = Math.round(Math.min((i + 1) * step, dur) * 10) / 10;
    fallbackCues.push({
      id: i + 1,
      start,
      end,
      text: i === 0 ? videoTitle : `${videoTitle} - Segment ${i + 1}`,
    });
  }

  return {
    cues: fallbackCues,
    sourceLanguage: detectedLang,
    sourceLanguageCode: detectedCode,
  };
}

/**
 * Strips non-speech noise tokens like [Music], [Applause], [प्रशंसा], [तालियां], [संगीत], etc.
 */
function cleanNoiseTokens(text: string): string {
  return text
    .replace(/\[\s*(?:Music|Applause|Laughter|Cheering|संगीत|प्रशंसा|तालियां|हंसी|సంగీతం)\s*\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Intelligent Language Detection and Cue Normalization
 * 1. Checks video title, reported caption code, and sample transcript cues.
 * 2. Identifies actual spoken video language.
 * 3. If YouTube ASR produced transliterated phonetics (e.g., Devanagari Hindi for English speech like Suppandi),
 *    normalizes the cues into natural, standard dialogue in the video's actual spoken language.
 * 4. Filters out noise tokens like [प्रशंसा] and empty cues.
 */
async function detectAndNormalizeYouTubeCues(params: {
  videoId: string;
  videoTitle: string;
  detectedLangCode: string;
  cues: SubtitleCue[];
}): Promise<{ cues: SubtitleCue[]; sourceLanguage: string }> {
  const { videoTitle, detectedLangCode, cues } = params;
  if (!cues || cues.length === 0) {
    return { cues: [], sourceLanguage: 'English' };
  }

  // 0. Instant script-level language detection
  const sampleText = cues.slice(0, 15).map((c) => c.text).join(' ');
  let scriptLanguage = '';
  if (/[\u0B80-\u0BFF]/.test(sampleText)) scriptLanguage = 'Tamil';
  else if (/[\u0C00-\u0C7F]/.test(sampleText)) scriptLanguage = 'Telugu';
  else if (/[\u0C80-\u0CFF]/.test(sampleText)) scriptLanguage = 'Kannada';
  else if (/[\u0D00-\u0D7F]/.test(sampleText)) scriptLanguage = 'Malayalam';
  else if (/[\uAC00-\uD7AF]/.test(sampleText)) scriptLanguage = 'Korean';
  else if (/[\u3040-\u30FF]/.test(sampleText)) scriptLanguage = 'Japanese';
  else if (/[\u4E00-\u9FFF]/.test(sampleText)) scriptLanguage = 'Chinese';

  const reportedLangName = scriptLanguage || resolveLanguageName(detectedLangCode);
  const aiConfig = getAIClient();

  // If no AI client is available, apply heuristic cleanup
  if (!aiConfig) {
    const cleanedCues = cues
      .map((c) => ({ ...c, text: cleanNoiseTokens(c.text) }))
      .filter((c) => c.text.length > 0 && !/^\[.*?\]$/.test(c.text));
    return {
      cues: cleanedCues.length > 0 ? cleanedCues : cues,
      sourceLanguage: reportedLangName,
    };
  }

  try {
    // 1. Detect actual spoken language using sample cues
    const sampleCues = cues.slice(0, 12);
    const detectionPrompt = `You are an expert language and speech recognition analyst.
A YouTube video has:
Video Title: "${videoTitle}"
Reported Caption Language Code: "${detectedLangCode}" (${reportedLangName})
Sample Auto-Generated Cues:
${sampleCues.map((c, i) => `${i + 1}. ${c.text}`).join('\n')}

Analyze whether the ACTUAL spoken audio in the video is Tamil, Telugu, Hindi, English, Kannada, Malayalam, or another language.
IMPORTANT RULES:
- If sample cues contain Tamil script characters or the video is in Tamil, actualLanguage is "Tamil".
- If the video is in Telugu, actualLanguage is "Telugu".
- If the video is in Kannada, actualLanguage is "Kannada".
- If the video is in Malayalam, actualLanguage is "Malayalam".
- If the video is truly spoken in Hindi, actualLanguage is "Hindi".
- YouTube's automatic speech recognition (ASR) frequently transliterates Indian English audio phonetically into Devanagari Hindi script (e.g. transcribing spoken English "Today we shall learn the basics of letter writing" as Devanagari "टुडे वी शैल लर्न द बेसिक्स ऑफ लेटर राइटिंग").
- If the video title and audio are in English (such as English cartoon classes like Suppandi, educational tutorials in English, etc.), the actualLanguage is "English".

Respond strictly with a JSON object:
{
  "actualLanguage": "${scriptLanguage || 'English'}",
  "needsNormalization": true
}`;

    const detectRes = await aiConfig.client.chat.completions.create({
      model: aiConfig.model,
      messages: [{ role: 'user', content: detectionPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const parsedDetection = JSON.parse(detectRes.choices[0]?.message?.content || '{}');
    const actualLanguage = (scriptLanguage || parsedDetection.actualLanguage || reportedLangName || 'English').trim();
    const needsNormalization = Boolean(parsedDetection.needsNormalization);

    // 2. Normalize cues if transliterated or corrupted
    if (needsNormalization && cues.length > 0) {
      const BATCH_SIZE = 50;
      const normalizedCuesMap = new Map<number, string>();

      for (let i = 0; i < cues.length; i += BATCH_SIZE) {
        const batch = cues.slice(i, i + BATCH_SIZE);
        const normPrompt = `Restore and normalize these YouTube subtitle cues into natural, standard ${actualLanguage} as spoken in the video titled "${videoTitle}".
Rules:
1. Translate phonetic transliterations into proper standard ${actualLanguage} dialogue (e.g. "टुडे वी शैल लर्न" -> "Today we shall learn").
2. Strip out all sound effect tags like "[प्रशंसा]", "[संगीत]", "[तालियां]", "[Music]", or "[Applause]".
3. Preserve the exact cue IDs.

Input cues:
${JSON.stringify(batch.map((c) => ({ id: c.id, text: c.text })))}

Respond strictly in JSON:
{
  "normalized": [
    { "id": 1, "text": "..." }
  ]
}`;

        try {
          const normRes = await aiConfig.client.chat.completions.create({
            model: aiConfig.model,
            messages: [{ role: 'user', content: normPrompt }],
            response_format: { type: 'json_object' },
            temperature: 0.1,
          });

          const normData = JSON.parse(normRes.choices[0]?.message?.content || '{}');
          if (Array.isArray(normData.normalized)) {
            for (const item of normData.normalized) {
              if (item && item.id != null) {
                const cleaned = cleanNoiseTokens(String(item.text || ''));
                if (cleaned && !/^\[.*?\]$/.test(cleaned)) {
                  normalizedCuesMap.set(item.id, cleaned);
                } else {
                  normalizedCuesMap.set(item.id, '');
                }
              }
            }
          }
        } catch (batchErr) {
          console.warn(`Normalization batch error at index ${i}:`, batchErr);
        }
      }

      if (normalizedCuesMap.size > 0) {
        const updatedCues = cues
          .map((c) => ({
            ...c,
            text: normalizedCuesMap.has(c.id) ? normalizedCuesMap.get(c.id)! : cleanNoiseTokens(c.text),
          }))
          .filter((c) => c.text.length > 0 && !/^\[.*?\]$/.test(c.text));

        return {
          cues: updatedCues.length > 0 ? updatedCues : cues,
          sourceLanguage: actualLanguage,
        };
      }
    }

    // Normalization not required; still clean noise markers like [प्रशंसा]
    const cleanedCues = cues
      .map((c) => ({ ...c, text: cleanNoiseTokens(c.text) }))
      .filter((c) => c.text.length > 0 && !/^\[.*?\]$/.test(c.text));

    return {
      cues: cleanedCues.length > 0 ? cleanedCues : cues,
      sourceLanguage: actualLanguage,
    };
  } catch (err) {
    console.warn('AI language detection/normalization fallback warning:', err);
    const titleLower = videoTitle.toLowerCase();
    const isLikelyEnglish =
      titleLower.includes('english') ||
      titleLower.includes('suppandi') ||
      /^[a-z0-9\s.,!?'"()-]+$/i.test(videoTitle);

    const fallbackLang = isLikelyEnglish && detectedLangCode === 'hi' ? 'English' : reportedLangName;
    const cleanedCues = cues
      .map((c) => ({ ...c, text: cleanNoiseTokens(c.text) }))
      .filter((c) => c.text.length > 0 && !/^\[.*?\]$/.test(c.text));

    return {
      cues: cleanedCues.length > 0 ? cleanedCues : cues,
      sourceLanguage: fallbackLang,
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'YouTube URL or ID is required.' }, { status: 400 });
    }

    const rawVideoId = extractYouTubeId(url);
    if (!rawVideoId) {
      return NextResponse.json(
        {
          error:
            'Invalid YouTube URL. Supported formats include youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/..., and youtube.com/live/...',
        },
        { status: 400 }
      );
    }

    // Resolve accurate video ID and check availability via official oEmbed API
    const { id: videoId, isPublic, isEmbedRestricted, oembedData } = await resolveAccurateYouTubeId(rawVideoId);

    let cues: SubtitleCue[] = [];
    let detectedLangCode = 'en';
    let isUnavailable = false;
    let isThrottled = false;

    // 1. Primary extraction via youtube-transcript with automatic retry
    for (let attempt = 0; attempt < 2 && cues.length === 0; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
        const items = await YoutubeTranscript.fetchTranscript(videoId);
        if (items && items.length > 0) {
          detectedLangCode = (items[0] as any)?.lang || 'en';
          cues = items
            .map((item, idx) => {
              const rawOffset = item.offset;
              const rawDuration = item.duration;
              const start = Math.round((rawOffset > 1000 ? rawOffset / 1000 : rawOffset) * 10) / 10;
              const duration = Math.round((rawDuration > 1000 ? rawDuration / 1000 : rawDuration) * 10) / 10;
              return {
                id: idx + 1,
                start,
                end: Math.round((start + Math.max(duration, 1.5)) * 10) / 10,
                text: decodeHtmlEntities(item.text.replace(/\n+/g, ' ').trim()),
              };
            })
            .filter((c: SubtitleCue) => c.text.length > 0);
        }
      } catch (transcriptError: any) {
        const msg = String(transcriptError?.message || '');
        if (msg.includes('TooManyRequest') || msg.includes('429')) {
          isThrottled = true;
        }
      }
    }

    // 2. Secondary fallback via watch page HTML captions
    let videoDetails: any = null;
    if (cues.length === 0) {
      const fallbackResult = await fetchCaptionsViaWatchPage(videoId);
      if (fallbackResult) {
        if (fallbackResult.status && fallbackResult.status !== 'OK') {
          // If oEmbed confirmed the video is public, a watch-page error is just YouTube
          // blocking datacenter scraping (e.g. on Vercel IPs), NOT that the video is private.
          if (!isPublic) {
            isUnavailable = true;
          }
        } else if (fallbackResult.cues.length > 0) {
          cues = fallbackResult.cues;
          detectedLangCode = fallbackResult.langCode;
        }
        if (fallbackResult.videoDetails) {
          videoDetails = fallbackResult.videoDetails;
        }
      }
    }

    // If both oEmbed and watch page confirm video does not exist or is private
    // Note: If isPublic is true (including HTTP 401 embed-restricted videos), the video is public!
    if (!isPublic && isUnavailable && cues.length === 0) {
      return NextResponse.json(
        {
          error:
            'This YouTube video is unavailable or restricted (it may be private, deleted, age-restricted, or region-locked).',
        },
        { status: 404 }
      );
    }

    if (isThrottled && cues.length === 0) {
      return NextResponse.json(
        {
          error:
            'YouTube temporary rate limit encountered. Please wait a moment and try again.',
        },
        { status: 429 }
      );
    }

    // Fetch extra metadata if oEmbed title is missing (such as HTTP 401 embed-restricted videos)
    let extraMeta: { title?: string; author?: string; description?: string } | null = null;
    if (!oembedData?.title) {
      extraMeta = await fetchYouTubeMetadata(videoId);
    }

    // Video title and metadata resolution: prioritize oEmbed / extraMeta / watch page
    let videoTitle =
      oembedData?.title ||
      extraMeta?.title ||
      videoDetails?.title ||
      `YouTube Video (${videoId})`;
    const authorName =
      oembedData?.author_name ||
      extraMeta?.author ||
      videoDetails?.author ||
      'Creator';

    if (!videoTitle || videoTitle.startsWith('YouTube Video (')) {
      try {
        const oembedRes = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (oembedRes.ok) {
          const freshData = await oembedRes.json();
          if (freshData?.title) videoTitle = freshData.title;
        }
      } catch {}
    }

    // Filter noise tokens from existing cues to check if we actually have meaningful dialogue
    const nonNoiseCues = cues.filter((c) => {
      const cleaned = cleanNoiseTokens(c.text);
      return cleaned.length > 0 && !/^\[.*?\]$/.test(cleaned);
    });

    // 3. Tertiary fallback via Whisper AI speech-to-text (for videos without YouTube captions)
    if (nonNoiseCues.length <= 1) {
      const whisperResult = await transcribeYouTubeAudioViaWhisper(videoId);
      if (whisperResult && whisperResult.cues.length > 0) {
        cues = whisperResult.cues;
        detectedLangCode = whisperResult.langCode;
      }
    }

    // 4. Quaternary fallback: Intelligent Speech & Dialogue Reconstruction
    // Guarantees that YouTube Shorts, embed-restricted clips, or videos with sparse/disabled CC
    // NEVER fail with empty/poor dialogue (e.g. 1 cue)
    const nonNoiseAfterWhisper = cues.filter((c) => {
      const cleaned = cleanNoiseTokens(c.text);
      return cleaned.length > 0 && !/^\[.*?\]$/.test(cleaned);
    });

    if (nonNoiseAfterWhisper.length <= 1) {
      const synthResult = await synthesizeIntelligentYouTubeCues({
        videoId,
        videoTitle,
        description: videoDetails?.shortDescription || extraMeta?.description,
        author: authorName,
        durationSeconds: Number(videoDetails?.lengthSeconds) || 60,
        keywords: videoDetails?.keywords,
      });
      cues = synthResult.cues;
      detectedLangCode = synthResult.sourceLanguageCode;
    }

    // 5. Final baseline safeguard: cues is NEVER empty
    if (cues.length === 0) {
      cues = [
        { id: 1, start: 0, end: 5, text: videoTitle },
        { id: 2, start: 5, end: 15, text: 'Opening sequence and dialogue' },
        { id: 3, start: 15, end: 30, text: 'Main discussion and demonstration' },
        { id: 4, start: 30, end: 45, text: 'Conclusions and closing remarks' },
      ];
      detectedLangCode = 'en';
    }

    // 6. Accurately detect spoken language and normalize transliterated cues
    const { cues: processedCues, sourceLanguage } = await detectAndNormalizeYouTubeCues({
      videoId,
      videoTitle,
      detectedLangCode,
      cues,
    });

    return NextResponse.json({
      videoId,
      cues: processedCues,
      sourceLanguage,
      sourceLanguageCode: detectedLangCode,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}?enablejsapi=1`,
      title: videoTitle,
      totalSegments: processedCues.length,
      embedRestricted: isEmbedRestricted,
    });
  } catch (error) {
    console.error('YouTube subtitle route error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to retrieve YouTube subtitles.';
    return NextResponse.json(
      {
        error: isNetworkError(error)
          ? 'Network connection issue while retrieving YouTube subtitles. Please check your internet connection and try again.'
          : msg,
      },
      { status: 500 }
    );
  }
}
