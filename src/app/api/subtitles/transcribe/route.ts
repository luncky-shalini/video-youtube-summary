import { isNetworkError } from '@/lib/network';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import https from 'node:https';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export interface SubtitleCue {
  id: number;
  start: number;
  end: number;
  text: string;
}

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
  const clean = code.toLowerCase().split('-')[0];
  return LANGUAGE_CODE_MAP[clean] || (clean.charAt(0).toUpperCase() + clean.slice(1));
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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No video file provided for transcription.' },
        { status: 400 }
      );
    }

    const fileName = file.name || 'uploaded_video.mp4';

    // Maximum file upload limit for direct serverless Whisper transcription (25MB)
    const MAX_FILE_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `Video file exceeds the direct transcription limit of 25MB (${(
            file.size /
            (1024 * 1024)
          ).toFixed(1)}MB). For large files, please extract/compress audio or use a YouTube URL.`,
        },
        { status: 413 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'No speech-to-text AI provider configured. Please set GROQ_API_KEY or OPENAI_API_KEY in .env.',
        },
        { status: 500 }
      );
    }

    const isGroq = Boolean(process.env.GROQ_API_KEY);
    const httpsAgent = new https.Agent({
      keepAlive: false, // Fresh socket per request to prevent stale keep-alive socket drops
      timeout: 120000,
    });

    const client = new OpenAI({
      apiKey,
      baseURL: isGroq
        ? 'https://api.groq.com/openai/v1'
        : process.env.OPENAI_BASE_URL || undefined,
      httpAgent: httpsAgent,
      maxRetries: 1,
      timeout: 120000,
    });

    const modelsToTry = isGroq
      ? ['whisper-large-v3-turbo', 'whisper-large-v3']
      : ['whisper-1'];

    // Convert Web File buffer to an OpenAI SDK-compatible uploadable file stream
    const arrayBuf = await file.arrayBuffer();
    const uploadableBuffer = Buffer.from(arrayBuf);
    const mimeType = file.type || (fileName.endsWith('.wav') ? 'audio/wav' : 'video/mp4');

    let transcriptionResult: any = null;
    let transcriptionErrorMsg = '';

    for (const model of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const uploadableFile = await toFile(uploadableBuffer, fileName, {
            type: mimeType,
          });

          transcriptionResult = await client.audio.transcriptions.create({
            file: uploadableFile,
            model,
            response_format: 'verbose_json',
          });

          if (transcriptionResult) {
            break;
          }
        } catch (err: any) {
          console.warn(`Whisper transcription error with model ${model} (attempt ${attempt}):`, err?.message || err);
          transcriptionErrorMsg = err instanceof Error ? err.message : String(err);
          if (attempt < 2 && isNetworkError(transcriptionErrorMsg)) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }
      if (transcriptionResult) {
        break;
      }
    }

    // If Groq models failed and OpenAI fallback key is available, attempt fallback
    if (!transcriptionResult && process.env.OPENAI_API_KEY && isGroq) {
      try {
        const fallbackClient = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          baseURL: process.env.OPENAI_BASE_URL || undefined,
          httpAgent: httpsAgent,
          maxRetries: 1,
          timeout: 60000,
        });
        const uploadableFallback = await toFile(uploadableBuffer, fileName, {
          type: mimeType,
        });
        transcriptionResult = await fallbackClient.audio.transcriptions.create({
          file: uploadableFallback,
          model: 'whisper-1',
          response_format: 'verbose_json',
        });
      } catch (fbErr) {
        console.warn('Fallback Whisper transcription error:', fbErr);
      }
    }

    if (!transcriptionResult) {
      const isNet = isNetworkError(transcriptionErrorMsg);
      const friendlyMsg = isNet
        ? 'Network connection issue while contacting transcription service. Please check your internet connection and try again.'
        : `Could not transcribe video: ${transcriptionErrorMsg || 'Speech recognition failed.'}`;

      return NextResponse.json({ error: friendlyMsg }, { status: 502 });
    }

    const segments = transcriptionResult?.segments || [];
    const cues: SubtitleCue[] = Array.isArray(segments)
      ? segments
          .map((seg: any, idx: number) => ({
            id: idx + 1,
            start: Math.round(Number(seg.start) * 10) / 10,
            end: Math.round(Number(seg.end) * 10) / 10,
            text: decodeHtmlEntities(String(seg.text || '').trim()),
          }))
          .filter((c: SubtitleCue) => c.text.length > 0)
      : [];

    if (cues.length === 0) {
      // Check if full transcript text exists even if segments array wasn't broken down
      if (typeof transcriptionResult?.text === 'string' && transcriptionResult.text.trim()) {
        cues.push({
          id: 1,
          start: 0.0,
          end: 10.0,
          text: decodeHtmlEntities(transcriptionResult.text.trim()),
        });
      } else {
        return NextResponse.json(
          { error: 'No spoken dialogue or speech segments could be extracted from this video.' },
          { status: 422 }
        );
      }
    }

    const detectedLanguage = resolveLanguageName(transcriptionResult?.language);

    return NextResponse.json({
      cues,
      source: 'whisper',
      language: detectedLanguage,
      totalSegments: cues.length,
    });
  } catch (error) {
    console.error('Transcription route fatal error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to transcribe video.';
    return NextResponse.json(
      {
        error: isNetworkError(error)
          ? 'Network connection error while processing video transcription. Please check your connection and try again.'
          : msg,
      },
      { status: 500 }
    );
  }
}
