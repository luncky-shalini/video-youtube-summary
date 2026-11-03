import { isNetworkError } from '@/lib/network';
import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import type { SubtitleCue } from '../translate/route';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
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

function resolveLanguageCode(name: string | undefined): string {
  if (!name) return 'en';
  const clean = name.toLowerCase().trim();
  for (const [code, langName] of Object.entries(LANGUAGE_CODE_MAP)) {
    if (langName.toLowerCase() === clean || code === clean) return code;
  }
  return 'en';
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
 * Resolves video title, channel, description, and official audio language
 * via YouTube Data API v3 (if key configured) or fast watch page HTML scraping fallback.
 */
async function fetchYouTubeMetadata(videoId: string): Promise<{
  title?: string;
  author?: string;
  description?: string;
  defaultAudioLanguage?: string;
  defaultLanguage?: string;
  tags?: string[];
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
            defaultAudioLanguage: item.snippet.defaultAudioLanguage,
            defaultLanguage: item.snippet.defaultLanguage,
            tags: item.snippet.tags,
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

interface InnerTubeCaptionResult {
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
  diagnostics?: any[];
}

/**
 * Robust XML parser for YouTube timedtext format.
 * Supports format 3 (<p t="..." d="..."><s>...</s></p>) and format 1 (<text start="..." dur="...">...).
 */
function parseTimedTextXml(xml: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];

  // Format 1: <p t="(\d+)" d="(\d+)"[^>]*>([\s\S]*?)<\/p>
  const pRegex = /<p\s+t="(\d+)"(?:\s+d="(\d+)")?[^>]*>([\s\S]*?)<\/p>/gi;
  let match: RegExpExecArray | null;
  while ((match = pRegex.exec(xml)) !== null) {
    const startMs = parseInt(match[1], 10);
    const durMs = match[2] ? parseInt(match[2], 10) : 2000;
    const rawInner = match[3] || '';
    let text = rawInner.replace(/<[^>]+>/g, '').trim();
    text = decodeHtmlEntities(text).replace(/\s+/g, ' ');
    if (text) {
      const start = Math.round((startMs / 1000) * 10) / 10;
      const end = Math.round(((startMs + Math.max(durMs, 1000)) / 1000) * 10) / 10;
      cues.push({
        id: cues.length + 1,
        start,
        end,
        text,
      });
    }
  }

  // Format 2: <text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>
  if (cues.length === 0) {
    const textRegex = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/gi;
    while ((match = textRegex.exec(xml)) !== null) {
      const startSec = parseFloat(match[1]);
      const durSec = match[2] ? parseFloat(match[2]) : 2;
      const rawInner = match[3] || '';
      let text = rawInner.replace(/<[^>]+>/g, '').trim();
      text = decodeHtmlEntities(text).replace(/\s+/g, ' ');
      if (text) {
        const start = Math.round(startSec * 10) / 10;
        const end = Math.round((startSec + Math.max(durSec, 1.5)) * 10) / 10;
        cues.push({
          id: cues.length + 1,
          start,
          end,
          text,
        });
      }
    }
  }

  return cues;
}

/**
 * Intelligent caption track selector:
 * Automatically selects the video's authentic original spoken language track
 * (e.g. Tamil, Telugu, Hindi, Korean) rather than defaulting to English.
 */
function pickBestCaptionTrack(captionTracks: any[], preferredLangCode?: string): any {
  if (!Array.isArray(captionTracks) || captionTracks.length === 0) return null;

  // 1. Preferred language (e.g. from YouTube Data API defaultAudioLanguage)
  if (preferredLangCode) {
    const cleanPref = preferredLangCode.toLowerCase().split('-')[0].trim();
    const match = captionTracks.find((t) => t.languageCode?.toLowerCase().split('-')[0].trim() === cleanPref);
    if (match) return match;
  }

  // 2. If there's only one track, return it
  if (captionTracks.length === 1) {
    return captionTracks[0];
  }

  // 3. Look for YouTube ASR (Automatic Speech Recognition) track, which reflects actual spoken audio
  const asrTrack = captionTracks.find((t) => t.kind === 'asr');
  if (asrTrack) return asrTrack;

  // 4. Default to first available track
  return captionTracks[0];
}

/**
 * Direct InnerTube Player API Client
 * Bypasses datacenter/cloud IP blocks by using Android and mobile client contexts with official InnerTube key.
 * Returns authentic transcript cues and original languageCode on both Local and Vercel.
 */
const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

async function fetchCaptionsViaInnerTube(
  videoId: string,
  preferredLangCode?: string
): Promise<InnerTubeCaptionResult | null> {
  const attempts = [
    // 1. Android Client with official InnerTube API Key (most reliable across datacenter and residential IPs)
    {
      url: `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}`,
      userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)',
      client: {
        clientName: 'ANDROID',
        clientVersion: '20.10.38',
        androidSdkVersion: 34,
        osName: 'Android',
        osVersion: '14',
        platform: 'MOBILE',
        hl: 'en',
        gl: 'IN',
      },
    },
    // 2. Android Client without key (India regional)
    {
      url: 'https://www.youtube.com/youtubei/v1/player',
      userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)',
      client: {
        clientName: 'ANDROID',
        clientVersion: '20.10.38',
        androidSdkVersion: 34,
        hl: 'en',
        gl: 'IN',
      },
    },
    // 3. Android Client with US regional
    {
      url: `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}`,
      userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)',
      client: {
        clientName: 'ANDROID',
        clientVersion: '20.10.38',
        androidSdkVersion: 34,
        osName: 'Android',
        osVersion: '14',
        platform: 'MOBILE',
        hl: 'en',
        gl: 'US',
      },
    },
  ];

  let lastVideoDetails: any = null;
  let lastStatus: string | undefined = undefined;
  const diagnostics: any[] = [];

  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': attempt.userAgent,
          'X-YouTube-Client-Name': '3',
          'X-YouTube-Client-Version': '20.10.38',
          'Origin': 'https://www.youtube.com',
        },
        body: JSON.stringify({
          context: { client: attempt.client },
          videoId,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        diagnostics.push({ url: attempt.url, httpStatus: res.status });
        continue;
      }
      const data = await res.json();
      const status = data?.playabilityStatus?.status;
      if (data?.videoDetails) lastVideoDetails = data.videoDetails;
      if (status) lastStatus = status;

      const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      diagnostics.push({
        url: attempt.url,
        httpStatus: res.status,
        playability: status,
        reason: data?.playabilityStatus?.reason,
        tracksCount: Array.isArray(captionTracks) ? captionTracks.length : 0,
      });

      if (status && status !== 'OK') {
        continue;
      }

      if (!Array.isArray(captionTracks) || captionTracks.length === 0) {
        continue;
      }

      const chosenTrack = pickBestCaptionTrack(captionTracks, preferredLangCode);
      if (!chosenTrack?.baseUrl) continue;

      // Fetch timedtext XML/JSON
      const subRes = await fetch(chosenTrack.baseUrl, {
        headers: {
          'User-Agent': attempt.userAgent,
          'Accept': 'text/xml,application/xml,*/*',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!subRes.ok) {
        diagnostics.push({ subUrl: chosenTrack.baseUrl.slice(0, 80), subStatus: subRes.status });
        continue;
      }

      const rawSub = await subRes.text();
      let cues: SubtitleCue[] = [];

      // Check if response is json3 format
      if (rawSub.trim().startsWith('{')) {
        try {
          const subData = JSON.parse(rawSub);
          const events = subData?.events || [];
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
            cues.push({
              id: cues.length + 1,
              start: Math.round((tStartMs / 1000) * 10) / 10,
              end: Math.round(((tStartMs + Math.max(dDurationMs, 1000)) / 1000) * 10) / 10,
              text,
            });
          }
        } catch {}
      }

      // If not json or json produced no cues, parse as XML
      if (cues.length === 0) {
        cues = parseTimedTextXml(rawSub);
      }

      if (cues.length > 0) {
        return {
          cues,
          langCode: chosenTrack.languageCode || 'en',
          videoDetails: data.videoDetails || lastVideoDetails,
          status: 'OK',
          diagnostics,
        };
      }
    } catch (clientErr) {
      diagnostics.push({ url: attempt.url, error: (clientErr as any)?.message });
      console.warn('InnerTube client attempt notice:', clientErr);
    }
  }

  return { cues: [], langCode: 'en', status: lastStatus, videoDetails: lastVideoDetails, diagnostics };
}

function parseSupadataContent(rawContent: any): SubtitleCue[] {
  if (!Array.isArray(rawContent) || rawContent.length === 0) return [];

  // Determine if offsets/durations are in milliseconds (Supadata default format)
  const isMs = rawContent.some(
    (item) => (item?.duration ?? item?.dur ?? 0) > 60 || (item?.offset ?? item?.start ?? 0) > 1000
  );

  const cues: SubtitleCue[] = [];

  for (let idx = 0; idx < rawContent.length; idx++) {
    const item = rawContent[idx];
    const rawText = item.text || item.content || item.line || '';
    const text = decodeHtmlEntities(String(rawText).replace(/\n+/g, ' ').trim());
    if (!text) continue;

    const rawOffset = Number(item.offset ?? item.start ?? 0);
    const rawDur = Number(item.duration ?? item.dur ?? (isMs ? 2000 : 2));

    const startSec = isMs ? rawOffset / 1000 : rawOffset;
    const durSec = isMs ? rawDur / 1000 : rawDur;

    const start = Math.round(startSec * 10) / 10;
    const end = Math.round((startSec + Math.max(durSec, 1.5)) * 10) / 10;

    cues.push({
      id: cues.length + 1,
      start,
      end,
      text,
    });
  }

  return cues;
}

interface SupadataResult {
  cues: SubtitleCue[];
  langCode: string;
  diagnostics?: any;
}

/**
 * Supadata YouTube Transcript Client
 * Cloud transcript extraction for serverless environments (Vercel)
 * where YouTube InnerTube returns LOGIN_REQUIRED on datacenter IPs.
 */
async function fetchTranscriptViaSupadata(
  videoId: string,
  preferredLang?: string
): Promise<SupadataResult | null> {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return {
      cues: [],
      langCode: 'en',
      diagnostics: { configured: false, reason: 'SUPADATA_API_KEY environment variable is missing on server' },
    };
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const langParam = preferredLang ? `&lang=${encodeURIComponent(preferredLang)}` : '';
  const endpoints = [
    `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(videoUrl)}${langParam}`,
    `https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(videoUrl)}${langParam}`,
    // If a preferredLang was requested, also try without lang parameter as a fallback
    ...(preferredLang
      ? [
          `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(videoUrl)}`,
          `https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(videoUrl)}`,
        ]
      : []),
  ];

  let lastStatus = 0;
  let lastError = '';

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey.trim(),
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      lastStatus = res.status;

      if (!res.ok) {
        // If status 202 (async generation), poll for completion
        if (res.status === 202) {
          const jobData = await res.json().catch(() => null);
          const jobId = jobData?.jobId || jobData?.id;
          if (jobId) {
            for (let poll = 0; poll < 6; poll++) {
              await new Promise((r) => setTimeout(r, 1500));
              const pollRes = await fetch(`https://api.supadata.ai/v1/transcript/${jobId}`, {
                headers: { 'x-api-key': apiKey.trim() },
                signal: AbortSignal.timeout(6000),
              });
              if (pollRes.status === 200) {
                const pollData = await pollRes.json();
                const cues = parseSupadataContent(pollData?.content);
                if (cues.length > 0) {
                  return {
                    cues,
                    langCode: pollData?.lang || preferredLang || 'en',
                    diagnostics: { configured: true, status: 200, polled: true },
                  };
                }
              }
            }
          }
        }
        continue;
      }

      const data = await res.json();
      const rawContent = data?.content || (Array.isArray(data) ? data : []);
      const cues = parseSupadataContent(rawContent);

      if (cues.length > 0) {
        return {
          cues,
          langCode: data?.lang || preferredLang || 'en',
          diagnostics: { configured: true, status: 200, count: cues.length, lang: data?.lang },
        };
      }
    } catch (err: any) {
      lastError = err?.message || String(err);
      console.warn('Supadata API fetch notice:', err);
    }
  }

  return {
    cues: [],
    langCode: 'en',
    diagnostics: { configured: true, status: lastStatus, error: lastError },
  };
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
  videoId: string,
  preferredLangCode?: string
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

    // Pick best track prioritizing original spoken language
    const track = pickBestCaptionTrack(captionTracks, preferredLangCode);
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
 * Direct audio stream extractor via InnerTube Player API.
 * Bypasses the need for Python or yt-dlp binary, running 100% inside Vercel Serverless Functions.
 */
async function downloadYouTubeAudioBuffer(videoId: string): Promise<Buffer | null> {
  const attempts = [
    {
      url: `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}`,
      userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)',
      client: {
        clientName: 'ANDROID',
        clientVersion: '20.10.38',
        androidSdkVersion: 34,
        osName: 'Android',
        osVersion: '14',
        platform: 'MOBILE',
        hl: 'en',
        gl: 'IN',
      },
    },
    {
      url: 'https://www.youtube.com/youtubei/v1/player',
      userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)',
      client: {
        clientName: 'ANDROID',
        clientVersion: '20.10.38',
        androidSdkVersion: 34,
        hl: 'en',
        gl: 'IN',
      },
    },
  ];

  for (const cfg of attempts) {
    try {
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': cfg.userAgent,
          'X-YouTube-Client-Name': '3',
          'X-YouTube-Client-Version': '20.10.38',
          'Origin': 'https://www.youtube.com',
        },
        body: JSON.stringify({
          context: { client: cfg.client },
          videoId,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) continue;
      const data = await res.json();
      const adaptive = data?.streamingData?.adaptiveFormats || [];
      const audioFormats = adaptive.filter((f: any) => f.mimeType && f.mimeType.startsWith('audio/') && f.url);
      if (audioFormats.length === 0) continue;

      // Prefer itag 140 (128kbps AAC) or 139 (48kbps AAC) or first available audio stream
      const bestAudio =
        audioFormats.find((f: any) => f.itag === 140) ||
        audioFormats.find((f: any) => f.itag === 139) ||
        audioFormats[0];

      if (!bestAudio?.url) continue;

      const audioRes = await fetch(bestAudio.url, {
        headers: {
          'User-Agent': cfg.userAgent,
        },
        signal: AbortSignal.timeout(20000),
      });

      if (!audioRes.ok) continue;
      const arrayBuf = await audioRes.arrayBuffer();
      if (arrayBuf.byteLength > 1000) {
        return Buffer.from(arrayBuf);
      }
    } catch (err) {
      console.warn('InnerTube audio stream notice:', err);
    }
  }

  return null;
}

/**
 * Tertiary speech-to-text fallback for YouTube videos without closed captions (e.g. Shorts/Reels).
 * 1. Downloads lightweight audio stream directly in Node.js (0 system dependencies, works on Vercel).
 * 2. Transcribes spoken speech and detects true original language using Whisper AI.
 */
async function transcribeYouTubeAudioViaWhisper(
  videoId: string
): Promise<{ cues: SubtitleCue[]; langCode: string } | null> {
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    let audioBuffer: Buffer | null = await downloadYouTubeAudioBuffer(videoId);

    // If pure Node.js direct stream was unavailable, fallback to python/yt-dlp if on local environment
    if (!audioBuffer && process.env.VERCEL !== '1') {
      const tmpFile = path.join(os.tmpdir(), `yt_audio_${videoId}_${Date.now()}.m4a`);
      try {
        await execFileAsync(
          'python',
          [
            '-m',
            'yt_dlp',
            '--no-playlist',
            '--max-filesize',
            '25m',
            '--socket-timeout',
            '8',
            '--retries',
            '1',
            '-f',
            'ba[ext=m4a]/ba[ext=mp3]/ba',
            '-o',
            tmpFile,
            `https://www.youtube.com/watch?v=${videoId}`,
          ],
          { timeout: 15000 }
        );
        if (fs.existsSync(tmpFile)) {
          audioBuffer = fs.readFileSync(tmpFile);
          try {
            fs.unlinkSync(tmpFile);
          } catch {}
        }
      } catch {}
    }

    if (!audioBuffer || audioBuffer.length === 0) return null;

    // Transcribe via Groq / OpenAI Whisper
    const isGroq = Boolean(process.env.GROQ_API_KEY);
    const client = new OpenAI({
      apiKey,
      baseURL: isGroq ? 'https://api.groq.com/openai/v1' : undefined,
      maxRetries: 2,
      timeout: 60000,
    });

    const uploadableFile = await toFile(audioBuffer, 'youtube_audio.m4a', {
      type: 'audio/mp4',
    });

    const model = isGroq ? 'whisper-large-v3-turbo' : 'whisper-1';
    const transcription: any = await client.audio.transcriptions.create({
      file: uploadableFile,
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
  }

  return null;
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
  else if (/[\u0900-\u097F]/.test(sampleText)) scriptLanguage = 'Hindi';

  const reportedLangName = scriptLanguage || resolveLanguageName(detectedLangCode);

  // If the cues are already in genuine native script (e.g. Tamil, Telugu, Kannada, Malayalam, Korean),
  // they represent authentic native dialogue and do not require AI normalization.
  // Transliteration normalization is only needed when English audio was erroneously transcribed as Devanagari Hindi.
  const isLikelyEnglishVideo =
    videoTitle.toLowerCase().includes('english') ||
    videoTitle.toLowerCase().includes('suppandi') ||
    /^[a-z0-9\s.,!?'"()-]+$/i.test(videoTitle);

  const isTransliteratedASR = scriptLanguage === 'Hindi' && isLikelyEnglishVideo;

  const isNativeLanguage =
    Boolean(scriptLanguage && scriptLanguage !== 'Hindi') ||
    ['Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Urdu', 'Korean', 'Japanese', 'Chinese'].includes(reportedLangName);

  if (isNativeLanguage && !isTransliteratedASR) {
    const cleanedCues = cues
      .map((c) => ({ ...c, text: cleanNoiseTokens(c.text) }))
      .filter((c) => c.text.length > 0 && !/^\[.*?\]$/.test(c.text));
    return {
      cues: cleanedCues.length > 0 ? cleanedCues : cues,
      sourceLanguage: scriptLanguage || reportedLangName,
    };
  }

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
Report Caption Language Code: "${detectedLangCode}" (${reportedLangName})
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

    // Fetch extra metadata (including defaultAudioLanguage if YOUTUBE_API_KEY is available)
    const extraMeta = await fetchYouTubeMetadata(videoId);

    let cues: SubtitleCue[] = [];
    let detectedLangCode = extraMeta?.defaultAudioLanguage || 'en';
    let isUnavailable = false;
    let isThrottled = false;
    let videoDetails: any = null;

    // 1. Primary extraction via YouTube InnerTube Player API
    // Works reliably on both residential IPs (Localhost) and datacenter/cloud IPs (Vercel)
    const innerTubeResult = await fetchCaptionsViaInnerTube(videoId, extraMeta?.defaultAudioLanguage);
    if (innerTubeResult) {
      if (innerTubeResult.cues.length > 0) {
        cues = innerTubeResult.cues;
        detectedLangCode = innerTubeResult.langCode;
      }
      if (innerTubeResult.videoDetails) {
        videoDetails = innerTubeResult.videoDetails;
      }
      if (innerTubeResult.status && innerTubeResult.status !== 'OK' && !isPublic) {
        isUnavailable = true;
      }
    }

    // 2. High-reliability fallback via Supadata API (bypasses datacenter IP blocks on Vercel)
    let supadataDiag: any = null;
    if (cues.length === 0 && !isUnavailable) {
      const supadataResult = await fetchTranscriptViaSupadata(videoId, extraMeta?.defaultAudioLanguage);
      if (supadataResult) {
        supadataDiag = supadataResult.diagnostics;
        if (supadataResult.cues.length > 0) {
          cues = supadataResult.cues;
          detectedLangCode = supadataResult.langCode;
        }
      }
    }

    // 3. Secondary fallback via youtube-transcript with automatic retry
    if (cues.length === 0 && !isUnavailable) {
      for (let attempt = 0; attempt < 2 && cues.length === 0; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, 600));
          }
          const items = await YoutubeTranscript.fetchTranscript(videoId);
          if (items && items.length > 0) {
            detectedLangCode = (items[0] as any)?.lang || detectedLangCode;
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
    }

    // 3. Tertiary fallback via watch page HTML captions
    if (cues.length === 0 && !isUnavailable) {
      const fallbackResult = await fetchCaptionsViaWatchPage(videoId, extraMeta?.defaultAudioLanguage);
      if (fallbackResult) {
        if (fallbackResult.status && fallbackResult.status !== 'OK') {
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

    // Video title and metadata resolution: prioritize oEmbed / extraMeta / videoDetails
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

    // 4. Speech-to-text fallback via Groq Whisper AI (for videos without closed captions)
    if (cues.length === 0) {
      const whisperResult = await transcribeYouTubeAudioViaWhisper(videoId);
      if (whisperResult && whisperResult.cues.length > 0) {
        cues = whisperResult.cues;
        detectedLangCode = whisperResult.langCode;
      }
    }

    // 5. Non-fabrication guarantee: If authentic captions and audio transcription both failed,
    // return an honest, descriptive error rather than generating fabricated dialogue or defaulting to English.
    if (cues.length === 0) {
      return NextResponse.json(
        {
          error:
            'Could not retrieve authentic dialogue or closed captions for this YouTube video. Please ensure the video has audible speech and is publicly accessible, or upload the video file directly.',
          diagnostics: {
            innerTube: innerTubeResult?.diagnostics,
            supadata: supadataDiag,
          },
        },
        { status: 422 }
      );
    }

    // 7. Accurately detect spoken language and normalize transliterated cues
    const { cues: processedCues, sourceLanguage } = await detectAndNormalizeYouTubeCues({
      videoId,
      videoTitle,
      detectedLangCode,
      cues,
    });

    const finalLangCode = resolveLanguageCode(sourceLanguage) || detectedLangCode || 'en';

    return NextResponse.json({
      videoId,
      cues: processedCues,
      sourceLanguage,
      sourceLanguageCode: finalLangCode,
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
