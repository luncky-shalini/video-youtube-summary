export interface CueItem {
  id?: number;
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface KeyTopicItem {
  topic: string;
  summary: string;
}

export interface KeyMomentItem {
  timestamp: string; // e.g. "[00:00]"
  speaker: string;   // e.g. "Speaker 1" or character name
  dialogueOrEvent: string; // actual dialogue or scene event
}

export interface CharacterDialogueItem {
  speaker: string; // e.g. "Speaker 1" or character name
  dialogue: string; // representative spoken dialogue
}

export interface VideoSynopsisData {
  title: string;
  originalLanguage: string;
  language: string;
  durationFormatted: string;
  sourceType: string;
  // 7 Required Sections
  executiveSummary: string;
  videoOverview?: string;
  detailedSynopsis: string;
  keyTopicsCovered: KeyTopicItem[];
  outcomesAndConclusions: string;
  keyMomentsTimeline: KeyMomentItem[];
  charactersSpeakersDialogue: CharacterDialogueItem[];
  // Backward compatibility aliases
  overview?: string;
  shortDescription?: string;
  introduction?: string;
  keyPoints?: string[];
  keyTopics?: KeyTopicItem[];
  keyMoments?: any[];
  decisions?: string;
  actionItems?: string[];
  openQuestions?: string[];
  conclusion?: string;
  cues: CueItem[];
}

/** Normalizes speaker label to strictly English "Speaker 1", "Speaker 2", etc. */
export function normalizeSpeakerLabel(speaker?: string, fallbackIndex = 1): string {
  if (!speaker) return `Speaker ${fallbackIndex}`;
  const trimmed = speaker.trim();

  // If already "Speaker N" (case-insensitive)
  const match = trimmed.match(/^speaker\s*(\d+)$/i);
  if (match) return `Speaker ${match[1]}`;

  // If contains digits with translated speaker words (e.g. వక్త 1, वक्ता 2, 说话者 3, 화자 1)
  const numMatch = trimmed.match(/\d+/);
  if (
    numMatch &&
    (trimmed.includes('వక్త') ||
      trimmed.includes('వక్తలు') ||
      trimmed.includes('वक्ता') ||
      trimmed.includes('वक्ताओं') ||
      trimmed.includes('说话者') ||
      trimmed.includes('发言者') ||
      trimmed.includes('화자') ||
      trimmed.toLowerCase().includes('speaker'))
  ) {
    return `Speaker ${numMatch[0]}`;
  }

  // If it's a generic untranslated word without number
  if (trimmed === 'వక్త' || trimmed === 'वक्ता' || trimmed === '说话者' || trimmed === '화자') {
    return `Speaker ${fallbackIndex}`;
  }

  return trimmed || `Speaker ${fallbackIndex}`;
}

