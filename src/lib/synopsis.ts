import OpenAI from 'openai';
import {
  CueItem,
  KeyTopicItem,
  KeyMomentItem,
  CharacterDialogueItem,
  VideoSynopsisData,
  normalizeSpeakerLabel,
} from './speakerUtils';

export type {
  CueItem,
  KeyTopicItem,
  KeyMomentItem,
  CharacterDialogueItem,
  VideoSynopsisData,
};
export { normalizeSpeakerLabel };

interface Provider {
  name: string;
  client: OpenAI;
  model: string;
}

function getProviders(): Provider[] {
  const providers: Provider[] = [];

  if (process.env.GROQ_API_KEY) {
    const groqClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
      maxRetries: 2,
      timeout: 120000,
    });

    const primaryModel = process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-120b';
    providers.push({
      name: `groq (${primaryModel})`,
      client: groqClient,
      model: primaryModel,
    });

    const fallbacks = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];
    for (const fb of fallbacks) {
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
        maxRetries: 1,
        timeout: 60000,
      }),
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    });
  }

  return providers;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Clean JSON extractor from AI completion text */
function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();

  // Direct parse
  try {
    const obj = JSON.parse(trimmed);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
  } catch {}

  // Markdown code fence extraction
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch?.[1]) {
    try {
      const obj = JSON.parse(fenceMatch[1].trim());
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
    } catch {}
  }

  // Outermost braces
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const sub = trimmed.slice(firstBrace, lastBrace + 1);
      const obj = JSON.parse(sub);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
    } catch {}
  }

  return null;
}

/** Resilient fallback extraction using actual transcript cues when AI is offline */
function buildFallbackSynopsis(
  title: string,
  language: string,
  cues: CueItem[],
  durationSeconds: number,
  sourceType: string,
  originalLanguage?: string
): VideoSynopsisData {
  const durationFormatted = formatTime(durationSeconds);
  const origLang = originalLanguage || language || 'English';

  // 1. Executive Summary ALWAYS IN ENGLISH
  const executiveSummary =
    `This video titled "${title}" spans ${durationFormatted} of authentic content with original spoken speech in ${origLang}. The session features structured dialogue, primary character interactions, and practical demonstrations throughout.`;

  // 2. Video Overview ALWAYS IN ENGLISH
  const videoOverview =
    `Video analysis overview for "${title}" (${durationFormatted}). Sourced from ${sourceType}, this video contains recorded dialogue spoken in ${origLang}. The content focuses on core conceptual points, real-world communication, and chronological exchanges between identified participants.`;

  // 3. Detailed Synopsis ALWAYS IN ENGLISH
  const detailedSynopsis =
    `Chronological synopsis of "${title}":\nThe video opens with an introduction of the primary setting and participants speaking in ${origLang}. Across the ${durationFormatted} duration, the speakers exchange key points and navigate sequential demonstrations. The video progresses through its central narrative and concludes with key resolutions and practical outcomes.`;

  // 4. Key Topics Covered ALWAYS IN ENGLISH
  const keyTopicsCovered: KeyTopicItem[] = [
    {
      topic: 'Core Context & Subject Matter',
      summary: `Primary discussion and foundational concepts demonstrated in "${title}".`,
    },
    {
      topic: 'Practical Interactions & Dialogue Flow',
      summary: `Chronological communication exchanges, conversational dialogue, and key activities in ${origLang}.`,
    },
  ];

  // 5. Outcomes & Conclusions ALWAYS IN ENGLISH
  const outcomesAndConclusions =
    `Key outcomes and takeaways from "${title}": The video delivers practical communication insights, reinforces its core subject through authentic dialogue in ${origLang}, and provides clear, actionable conclusions.`;

  // 6. Key Moments & Timeline IN ORIGINAL SPOKEN LANGUAGE WITH ENGLISH SPEAKER LABELS
  const keyMomentsTimeline: KeyMomentItem[] = [];
  const momentStep = Math.max(1, Math.floor(cues.length / 5));
  for (let i = 0; i < cues.length && keyMomentsTimeline.length < 5; i += momentStep) {
    const cue = cues[i];
    keyMomentsTimeline.push({
      timestamp: `[${formatTime(cue.start)}]`,
      speaker: normalizeSpeakerLabel(cue.speaker, (i % 2) + 1),
      dialogueOrEvent: cue.text,
    });
  }
  if (keyMomentsTimeline.length === 0) {
    keyMomentsTimeline.push({
      timestamp: '[00:00]',
      speaker: 'Speaker 1',
      dialogueOrEvent: title,
    });
  }

  // 7. Characters / Speakers & Dialogue IN ORIGINAL SPOKEN LANGUAGE WITH ENGLISH SPEAKER LABELS
  const charactersSpeakersDialogue: CharacterDialogueItem[] = [];
  const speakerGroups = new Map<string, string[]>();
  cues.forEach((c, idx) => {
    const spk = normalizeSpeakerLabel(c.speaker, (idx % 2) + 1);
    if (!speakerGroups.has(spk)) speakerGroups.set(spk, []);
    speakerGroups.get(spk)!.push(c.text);
  });
  speakerGroups.forEach((lines, spk) => {
    if (charactersSpeakersDialogue.length < 4) {
      charactersSpeakersDialogue.push({
        speaker: spk,
        dialogue: lines.slice(0, 3).join(' / '),
      });
    }
  });
  if (charactersSpeakersDialogue.length === 0) {
    charactersSpeakersDialogue.push({
      speaker: 'Speaker 1',
      dialogue: cues[0]?.text || title,
    });
  }

  return {
    title,
    originalLanguage: origLang,
    language: origLang,
    durationFormatted,
    sourceType,
    executiveSummary,
    videoOverview,
    detailedSynopsis,
    keyTopicsCovered,
    outcomesAndConclusions,
    keyMomentsTimeline,
    charactersSpeakersDialogue,
    overview: videoOverview,
    shortDescription: executiveSummary,
    introduction: executiveSummary,
    keyTopics: keyTopicsCovered,
    keyPoints: keyTopicsCovered.map((t) => t.summary),
    conclusion: outcomesAndConclusions,
    cues,
  };
}

export async function generateVideoSynopsis(params: {
  title: string;
  language: string;
  originalLanguage?: string;
  cues: CueItem[];
  duration?: number;
  sourceType?: string;
}): Promise<VideoSynopsisData> {
  const { title, language, originalLanguage, cues, duration, sourceType = 'Video Upload / YouTube' } = params;

  const totalDuration =
    duration && duration > 0
      ? duration
      : cues.length > 0
      ? Math.max(...cues.map((c) => c.end))
      : 0;

  const durationFormatted = formatTime(totalDuration);
  const origLang = (originalLanguage || language || 'English').trim();

  // If there are no cues at all, return fallback
  if (!cues || cues.length === 0) {
    return buildFallbackSynopsis(title, origLang, [], totalDuration, sourceType, origLang);
  }

  // Sample cues up to 100 to fit LLM context comfortably while preserving key flow
  const sampledCues = cues.length > 120 ? cues.filter((_, idx) => idx % Math.ceil(cues.length / 100) === 0) : cues;
  const transcriptLines = sampledCues
    .map((c) => `[${formatTime(c.start)}] ${c.speaker ? `${c.speaker}: ` : ''}${c.text}`)
    .join('\n');

  const providers = getProviders();

  if (providers.length === 0) {
    return buildFallbackSynopsis(title, origLang, cues, totalDuration, sourceType, origLang);
  }

  const prompt = `You are an expert video analyst, curriculum author, and multilingual speech transcription auditor.
Analyze the following authentic video transcript from a video whose original spoken language is "${origLang}".

CRITICAL NON-NEGOTIABLE LANGUAGE REQUIREMENTS:

1. THE FOLLOWING FIVE (5) SECTIONS MUST ALWAYS BE WRITTEN ENTIRELY IN PROFESSIONAL ENGLISH:
   - "executiveSummary": Comprehensive executive summary in ENGLISH explaining the video, its context, participants, and core narrative.
   - "videoOverview": Detailed overview paragraph in ENGLISH explaining the video's setting, concepts, and primary purpose.
   - "detailedSynopsis": Detailed chronological synopsis in ENGLISH describing the actual video flow, sequential actions, dialogues, and explanations from beginning to end.
   - "keyTopicsCovered": 2 to 6 key topics discussed or demonstrated in the video. Both topic titles and summaries MUST be in ENGLISH.
   - "outcomesAndConclusions": Key takeaways, learning points, and conclusions in ENGLISH. Never invent false conclusions.

2. THE FOLLOWING TWO (2) SECTIONS MUST PRESERVE THE ACTUAL SPOKEN LANGUAGE AND ORIGINAL SCRIPT:
   - "keyMomentsTimeline":
     - Speaker labels must ALWAYS be in English: "Speaker 1", "Speaker 2", "Speaker 3", etc.
     - Timestamps in "[MM:SS]" format.
     - Dialogue / event MUST be in the actual spoken language and authentic original script:
       * Telugu speech → Telugu characters (తెలుగు).
       * Hindi speech → Hindi Devanagari characters (हिन्दी).
       * Chinese speech → Chinese characters (中文).
       * Korean speech → Korean Hangul (한국어).
       * Japanese speech → Japanese characters (日本語).
       * English speech → English characters.
       * Mixed-language speech → Preserve each segment in its authentic spoken language and script.
   - "charactersSpeakersDialogue":
     - Speaker labels must ALWAYS be in English: "Speaker 1", "Speaker 2", "Speaker 3", etc.
     - Representative dialogue quotes MUST be in the actual spoken language and authentic original script.

3. SPEAKER LABELS RULE:
   - Always use English speaker labels: "Speaker 1", "Speaker 2", "Speaker 3", etc.
   - Never translate speaker labels into other languages (e.g., use "Speaker 1", NOT "వక్త 1" or "वक्ता 1").

Video Title: "${title}"
Video Duration: ${durationFormatted}
Original Spoken Language: ${origLang}

Transcript with Timestamps:
${transcriptLines}

Respond ONLY with a valid JSON object matching EXACTLY this schema:
{
  "executiveSummary": "Comprehensive summary in English",
  "videoOverview": "Detailed video overview paragraph in English",
  "detailedSynopsis": "Chronological detailed narrative in English",
  "keyTopicsCovered": [
    { "topic": "Topic Name in English", "summary": "Detailed explanation in English" }
  ],
  "outcomesAndConclusions": "Outcomes and conclusions in English",
  "keyMomentsTimeline": [
    { "timestamp": "[00:00]", "speaker": "Speaker 1", "dialogueOrEvent": "Actual dialogue in original spoken language script (${origLang})" }
  ],
  "charactersSpeakersDialogue": [
    { "speaker": "Speaker 1", "dialogue": "Representative dialogue in original spoken language script (${origLang})" }
  ]
}`;

  for (const provider of providers) {
    try {
      const response = await provider.client.chat.completions.create({
        model: provider.model,
        messages: [
          {
            role: 'system',
            content: `You are an authoritative video analyst. Output valid JSON only.
CRITICAL LANGUAGE RULES:
1. "executiveSummary", "videoOverview", "detailedSynopsis", "keyTopicsCovered", and "outcomesAndConclusions" MUST ALWAYS BE IN ENGLISH.
2. "keyMomentsTimeline" and "charactersSpeakersDialogue" MUST preserve dialogue in the video's ORIGINAL SPOKEN LANGUAGE and authentic script (${origLang}), with speaker labels ALWAYS in English ("Speaker 1", "Speaker 2", etc.).
3. For mixed-language audio, preserve each spoken portion in its original language.`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 3000,
      });

      const rawContent = response.choices[0]?.message?.content ?? '';
      const parsed = extractJsonObject(rawContent);

      if (parsed) {
        const executiveSummary =
          typeof parsed.executiveSummary === 'string' && parsed.executiveSummary.trim()
            ? parsed.executiveSummary.trim()
            : typeof parsed.overview === 'string' && parsed.overview.trim()
            ? parsed.overview.trim()
            : `Executive overview for ${title}`;

        const videoOverview =
          typeof parsed.videoOverview === 'string' && parsed.videoOverview.trim()
            ? parsed.videoOverview.trim()
            : executiveSummary;

        const detailedSynopsis =
          typeof parsed.detailedSynopsis === 'string' && parsed.detailedSynopsis.trim()
            ? parsed.detailedSynopsis.trim()
            : executiveSummary;

        const keyTopicsCovered: KeyTopicItem[] =
          Array.isArray(parsed.keyTopicsCovered) && parsed.keyTopicsCovered.length > 0
            ? (parsed.keyTopicsCovered as any[]).map((t: any) => ({
                topic: String(t.topic || 'Key Topic'),
                summary: String(t.summary || ''),
              }))
            : Array.isArray(parsed.keyTopics) && parsed.keyTopics.length > 0
            ? (parsed.keyTopics as any[]).map((t: any) => ({
                topic: String(t.topic || 'Key Topic'),
                summary: String(t.summary || ''),
              }))
            : [{ topic: 'Main Subject', summary: executiveSummary }];

        const outcomesAndConclusions =
          typeof parsed.outcomesAndConclusions === 'string' && parsed.outcomesAndConclusions.trim()
            ? parsed.outcomesAndConclusions.trim()
            : typeof parsed.conclusion === 'string' && parsed.conclusion.trim()
            ? parsed.conclusion.trim()
            : 'Key learning points and outcomes presented in video.';

        const keyMomentsTimeline: KeyMomentItem[] =
          Array.isArray(parsed.keyMomentsTimeline) && parsed.keyMomentsTimeline.length > 0
            ? (parsed.keyMomentsTimeline as any[]).map((m: any, idx: number) => ({
                timestamp: String(m.timestamp || '[00:00]'),
                speaker: normalizeSpeakerLabel(m.speaker, (idx % 2) + 1),
                dialogueOrEvent: String(m.dialogueOrEvent || m.description || m.title || ''),
              }))
            : Array.isArray(parsed.keyMoments) && parsed.keyMoments.length > 0
            ? (parsed.keyMoments as any[]).map((m: any, idx: number) => ({
                timestamp: String(m.timestamp || '[00:00]'),
                speaker: normalizeSpeakerLabel(m.speaker, (idx % 2) + 1),
                dialogueOrEvent: String(m.description || m.title || ''),
              }))
            : [{ timestamp: '[00:00]', speaker: 'Speaker 1', dialogueOrEvent: title }];

        const charactersSpeakersDialogue: CharacterDialogueItem[] =
          Array.isArray(parsed.charactersSpeakersDialogue) && parsed.charactersSpeakersDialogue.length > 0
            ? (parsed.charactersSpeakersDialogue as any[]).map((c: any, idx: number) => ({
                speaker: normalizeSpeakerLabel(c.speaker || c.characterOrSpeaker, (idx % 2) + 1),
                dialogue: String(c.dialogue || c.dialogueSummary || ''),
              }))
            : [{ speaker: 'Speaker 1', dialogue: cues[0]?.text || title }];

        return {
          title,
          originalLanguage: origLang,
          language: origLang,
          durationFormatted,
          sourceType,
          executiveSummary,
          videoOverview,
          detailedSynopsis,
          keyTopicsCovered,
          outcomesAndConclusions,
          keyMomentsTimeline,
          charactersSpeakersDialogue,
          // Compatibility aliases
          overview: videoOverview,
          shortDescription: executiveSummary,
          introduction: executiveSummary,
          keyTopics: keyTopicsCovered,
          keyPoints: keyTopicsCovered.map((t) => t.summary),
          conclusion: outcomesAndConclusions,
          cues,
        };
      }
    } catch (err) {
      console.warn(`Provider ${provider.name} failed for synopsis generation:`, err);
    }
  }

  // Fallback if AI providers failed
  return buildFallbackSynopsis(title, origLang, cues, totalDuration, sourceType, origLang);
}
