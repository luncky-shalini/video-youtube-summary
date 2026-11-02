import { isNetworkError } from '@/lib/network';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import https from 'node:https';

export interface SubtitleCue {
  id: number;
  start: number;
  end: number;
  text: string;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  te: 'Telugu',
  hi: 'Hindi',
  zh: 'Chinese (Simplified)',
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
  telugu: 'Telugu',
  hindi: 'Hindi',
  chinese: 'Chinese (Simplified)',
  korean: 'Korean',
  english: 'English',
  spanish: 'Spanish',
  french: 'French',
  german: 'German',
  japanese: 'Japanese',
};

function getAIClient() {
  const httpsAgent = new https.Agent({
    keepAlive: false,
    timeout: 120000,
  });

  if (process.env.GROQ_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
        httpAgent: httpsAgent,
        maxRetries: 2,
        timeout: 120000,
      }),
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      fallbackModels: ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b'],
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL || undefined,
        httpAgent: httpsAgent,
        maxRetries: 1,
        timeout: 60000,
      }),
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      fallbackModels: ['gpt-3.5-turbo'],
    };
  }
  throw new Error('No AI provider configured. Please set GROQ_API_KEY or OPENAI_API_KEY in .env.');
}

/**
 * Resilient multi-tier JSON extractor:
 * Handles pure JSON arrays, markdown-wrapped JSON, wrapped objects {cues:[...]},
 * and recovers individual valid JSON objects if output was partially truncated.
 */
function extractTranslatedItems(rawContent: string): Array<{ id: number; text: string }> {
  let cleaned = rawContent.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  // 1. Direct JSON.parse
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item?.id === 'number' && typeof item?.text === 'string');
    }
    // If the model wrapped the array inside an object like { translations: [...] } or { cues: [...] }
    if (parsed && typeof parsed === 'object') {
      for (const key of Object.keys(parsed)) {
        if (Array.isArray((parsed as any)[key])) {
          const arr = (parsed as any)[key].filter(
            (item: any) => typeof item?.id === 'number' && typeof item?.text === 'string'
          );
          if (arr.length > 0) return arr;
        }
      }
    }
  } catch {
    // Continue to fallback parsing
  }

  // 2. Bracket slice extraction [ ... ]
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      const slice = cleaned.slice(firstBracket, lastBracket + 1);
      const parsed = JSON.parse(slice);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter((item) => typeof item?.id === 'number' && typeof item?.text === 'string');
        if (valid.length > 0) return valid;
      }
    } catch {
      // Continue to regex recovery
    }
  }

  // 3. Resilient regex item recovery for broken JSON or stream cutoffs
  // Matches {"id": 1, "text": "..."} patterns individually
  const itemRegex = /\{\s*"?id"?\s*:\s*(\d+)\s*,\s*"?text"?\s*:\s*"((?:\\.|[^"\\])*)"\s*\}/g;
  const recovered: Array<{ id: number; text: string }> = [];
  let m: RegExpExecArray | null;

  while ((m = itemRegex.exec(cleaned)) !== null) {
    try {
      const id = parseInt(m[1], 10);
      const text = JSON.parse(`"${m[2]}"`);
      if (!isNaN(id) && typeof text === 'string' && text.trim().length > 0) {
        recovered.push({ id, text: text.trim() });
      }
    } catch {
      // Unescaped character fallback
      recovered.push({ id: parseInt(m[1], 10), text: m[2] });
    }
  }

  if (recovered.length > 0) {
    return recovered;
  }

  // 4. Line-based recovery if model outputted numbered items like "1. <text>"
  const lines = cleaned.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const lineRecovered: Array<{ id: number; text: string }> = [];
  for (const line of lines) {
    const lineMatch = line.match(/^(\d+)[\.\:\-\)]\s*(.+)$/);
    if (lineMatch) {
      const id = parseInt(lineMatch[1], 10);
      const text = lineMatch[2].replace(/^["']|["']$/g, '').trim();
      if (!isNaN(id) && text.length > 0) {
        lineRecovered.push({ id, text });
      }
    }
  }

  return lineRecovered;
}

/**
 * Translates a single batch with automatic retries and fallback models
 */
async function translateBatch(
  client: OpenAI,
  primaryModel: string,
  fallbackModels: string[],
  batch: Array<{ id: number; text: string }>,
  targetLanguage: string,
  sourceLanguage?: string,
  maxRetries = 2
): Promise<Map<number, string>> {
  const srcContext = sourceLanguage ? `from ${sourceLanguage} ` : '';
  const prompt = `Translate the following video subtitle dialogue segments ${srcContext}into natural, fluent ${targetLanguage}.

CRITICAL REQUIREMENTS:
1. Translate EVERY item in the input array.
2. Maintain the EXACT same integer "id" for every segment.
3. Return ONLY a valid JSON array of objects with keys "id" (number) and "text" (translated string).
4. Do NOT include markdown formatting or explanations.

Input:
${JSON.stringify(batch)}`;

  const modelsToTry = [primaryModel, ...fallbackModels];
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const completion = await client.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: `You are an expert video subtitle translator. You translate accurately into ${targetLanguage}. You must output exclusively a valid raw JSON array of objects with numeric "id" and string "text". Never include markdown fences or preamble.`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1,
          max_tokens: Math.max(1500, batch.length * 75),
        });

        const rawContent = completion.choices[0]?.message?.content?.trim() || '';
        const items = extractTranslatedItems(rawContent);

        if (items.length === 0) {
          throw new Error('AI returned an empty translation format or invalid JSON structure.');
        }

        const map = new Map<number, string>();
        for (const item of items) {
          if (typeof item.id === 'number' && typeof item.text === 'string' && item.text.trim()) {
            map.set(item.id, item.text.trim());
          }
        }

        if (map.size > 0) {
          return map;
        }

        throw new Error('No valid translated segments could be recovered from AI response.');
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
      }
    }
  }

  throw lastError || new Error('Failed to translate batch after retries.');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cues, targetLanguage, sourceLanguage } = body as {
      cues: SubtitleCue[];
      targetLanguage: string;
      sourceLanguage?: string;
    };

    if (!cues || !Array.isArray(cues) || cues.length === 0) {
      return NextResponse.json({ error: 'No subtitle cues provided.' }, { status: 400 });
    }

    if (!targetLanguage || typeof targetLanguage !== 'string') {
      return NextResponse.json({ error: 'Target language is required.' }, { status: 400 });
    }

    const langKey = targetLanguage.trim().toLowerCase();
    const resolvedLang = LANGUAGE_NAMES[langKey] || targetLanguage;

    // Only bypass if the cues are already in the requested target language
    if (
      sourceLanguage &&
      sourceLanguage.trim().toLowerCase() === resolvedLang.toLowerCase()
    ) {
      return NextResponse.json({ cues, targetLanguage: resolvedLang, totalSegments: cues.length });
    }

    const { client, model, fallbackModels } = getAIClient();

    // Prepare lightweight items with id and text
    const textItems = cues.map((c) => ({ id: c.id, text: c.text }));

    // Chunk cues into batches of up to 25 segments to prevent AI token truncation on long videos
    const BATCH_SIZE = 25;
    const batches: Array<Array<{ id: number; text: string }>> = [];
    for (let i = 0; i < textItems.length; i += BATCH_SIZE) {
      batches.push(textItems.slice(i, i + BATCH_SIZE));
    }

    // Execute batches (concurrency of 3 to avoid rate-limiting while being fast)
    const translationMap = new Map<number, string>();
    const CONCURRENCY = 3;

    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const slice = batches.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        slice.map((batch) =>
          translateBatch(client, model, fallbackModels, batch, resolvedLang, sourceLanguage)
        )
      );

      for (const batchMap of results) {
        for (const [id, text] of batchMap.entries()) {
          translationMap.set(id, text);
        }
      }
    }

    // Validate that translation actually occurred
    if (translationMap.size === 0) {
      return NextResponse.json(
        { error: 'AI translation failed to produce any translated subtitle segments. Please try again.' },
        { status: 500 }
      );
    }

    // Map translated text back to original cues preserving exact chronological timestamps
    let translatedCount = 0;
    const translatedCues: SubtitleCue[] = cues.map((original) => {
      const translated = translationMap.get(original.id);
      if (translated && translated.trim().length > 0) {
        translatedCount++;
        return {
          ...original,
          text: translated.trim(),
        };
      }
      return original;
    });

    if (translatedCount === 0) {
      return NextResponse.json(
        { error: 'Translation response could not be mapped to subtitle segments. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      cues: translatedCues,
      targetLanguage: resolvedLang,
      totalSegments: translatedCues.length,
      translatedSegments: translatedCount,
    });
  } catch (error) {
    console.error('Subtitle translation error:', error);
    const msg = error instanceof Error ? error.message : 'Subtitle translation failed';
    return NextResponse.json(
      {
        error: isNetworkError(error)
          ? 'Network connection issue while contacting AI translation service. Please check your internet connection and try again.'
          : msg,
      },
      { status: 500 }
    );
  }
}
