import 'server-only';

import OpenAI from 'openai';
import type { YouTubeVideoMeta } from '@/lib/types';

export interface TokenCount {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface VideoDigest {
  video: YouTubeVideoMeta;
  digest: string;
  hadTranscript: boolean;
}

interface Provider {
  name: string;
  client: OpenAI;
  model: string;
}

/**
 * Provider chain, tried in order. Groq first (fast + free tier), then
 * OpenAI or any OpenAI-compatible endpoint via OPENAI_BASE_URL.
 */
function getProviders(): Provider[] {
  const providers: Provider[] = [];

  if (process.env.GROQ_API_KEY) {
    const groqClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
      // Groq free tier has per-minute token limits; the SDK honors
      // retry-after on 429s, so retries ride out the rate window.
      maxRetries: 3,
    });

    const primaryModel = process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-120b';
    providers.push({
      name: `groq (${primaryModel})`,
      client: groqClient,
      model: primaryModel,
    });

    // Active fallback models on Groq in case the primary model is decommissioned,
    // not available on the user's tier, or rate-limited.
    const candidateFallbacks = [
      'openai/gpt-oss-120b',
      'qwen/qwen3.8-27b',
      'openai/gpt-oss-20b',
    ];
    for (const fb of candidateFallbacks) {
      if (fb !== primaryModel) {
        providers.push({
          name: `groq (${fb})`,
          client: groqClient,
          model: fb,
        });
      }
    }
  }

  if (process.env.OPENAI_API_KEY) {
    providers.push({
      name: 'openai',
      client: new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL || undefined,
        maxRetries: 0, // fallback should fail fast, not stall the request
      }),
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    });
  }

  if (providers.length === 0) {
    throw new Error('No AI provider configured — set GROQ_API_KEY or OPENAI_API_KEY');
  }
  return providers;
}

function addUsage(total: TokenCount, usage?: OpenAI.CompletionUsage | null) {
  if (!usage) return;
  total.promptTokens += usage.prompt_tokens ?? 0;
  total.completionTokens += usage.completion_tokens ?? 0;
  total.totalTokens += usage.total_tokens ?? 0;
}

/** Try each provider in order; return the first successful completion. */
async function chat(
  messages: OpenAI.ChatCompletionMessageParam[],
  opts: { maxTokens: number; temperature: number },
  tokens: TokenCount,
): Promise<string> {
  const errors: string[] = [];
  for (const provider of getProviders()) {
    try {
      const res = await provider.client.chat.completions.create({
        model: provider.model,
        messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
      });
      addUsage(tokens, res.usage);
      return res.choices[0]?.message?.content ?? '';
    } catch (err) {
      errors.push(`${provider.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`All AI providers failed — ${errors.join(' | ')}`);
}

/**
 * Stage 1 — condense one video (transcript or metadata) into key points.
 * Kept short so ten of these fit comfortably into the combine prompt.
 */
export async function digestVideo(
  video: YouTubeVideoMeta,
  transcript: string | null,
  tokens: TokenCount,
): Promise<VideoDigest> {
  const source = transcript
    ? `Transcript (may be auto-generated, tolerate errors):\n${transcript}`
    : `No transcript is available. Use the title, channel, and your own knowledge of this well-known topic to infer what such a tutorial covers.`;

  const digest = await chat(
    [
      {
        role: 'system',
        content:
          'You are an expert technical educator. Extract the substantive teaching content from a YouTube video for later merging into study notes. Output concise markdown: key concepts, explanations, examples, and notable tips. No preamble.',
      },
      {
        role: 'user',
        content: `Video: "${video.title}" by ${video.channel} (${video.duration})\n\n${source}`,
      },
    ],
    { maxTokens: 700, temperature: 0.3 },
    tokens,
  );

  return { video, digest, hadTranscript: Boolean(transcript) };
}

/**
 * Stage 2 — merge all video digests into one deduplicated, structured study
 * document following the platform's required section layout.
 */
export async function combineNotes(
  topic: string,
  digests: VideoDigest[],
  tokens: TokenCount,
): Promise<string> {
  const corpus = digests
    .map((d, i) => `--- Video ${i + 1}: "${d.video.title}" (${d.video.channel}) ---\n${d.digest}`)
    .join('\n\n');

  return chat(
    [
      {
        role: 'system',
        content: `You are an expert curriculum author. Merge notes from multiple videos on the same topic into ONE high-quality study document. Remove duplicate content, resolve contradictions, and organize logically. The result must be better than any single video's notes.

Output GitHub-flavored markdown with EXACTLY these top-level sections, in this order:

# Overview
Short introduction to the topic.

# Key Concepts
The important concepts, each named and defined in one line.

# Detailed Explanation
Explain each key concept in depth.

# Examples
Real-world examples (code where appropriate).

# Important Points
A bullet list of must-remember points.

# Interview Questions
8-12 realistic interview questions with brief model answers.

# Quiz
Exactly 10 multiple-choice questions. Number each question ("1." through "10."), put each of the four options on its own line formatted exactly "A) option text" through "D) option text", and end the section with a "### Answer Key" heading followed by one line per question in the form "1. B".

# Practical Exercises
3-5 hands-on tasks of increasing difficulty.

# Resources
Additional learning resources (official docs, books, courses).`,
      },
      {
        role: 'user',
        content: `Topic: ${topic}\n\nNotes extracted from ${digests.length} videos:\n\n${corpus}`,
      },
    ],
    { maxTokens: 4000, temperature: 0.4 },
    tokens,
  );
}
