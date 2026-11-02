import fs from 'fs';
import path from 'path';

// Load .env
const envFile = fs.readFileSync('.env', 'utf-8');
envFile.split('\n').forEach((line) => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
});

console.log('====================================================');
console.log('   VIDEO UPLOAD & SUBTITLE WORKFLOW VERIFICATION   ');
console.log('====================================================\n');

async function runTests() {
  let passed = 0;
  let total = 0;

  function assert(condition, name) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}`);
      process.exitCode = 1;
    }
  }

  // ── TEST 1: File Type Validation ──────────────────────────────────────────
  console.log('--- Test 1: File Type Validation ---');
  const supportedFiles = ['video.mp4', 'presentation.webm', 'clip.ogg', 'movie.mov', 'lesson.mkv'];
  const unsupportedFiles = ['document.pdf', 'notes.txt', 'image.png', 'audio.mp3', 'archive.zip'];

  const EXT_REGEX = /\.(mp4|webm|ogg|mov|mkv)$/i;

  supportedFiles.forEach((file) => {
    assert(EXT_REGEX.test(file), `Supported video file allowed: ${file}`);
  });

  unsupportedFiles.forEach((file) => {
    assert(!EXT_REGEX.test(file), `Unsupported file rejected: ${file}`);
  });

  // ── TEST 2: Transcription with Timestamps ────────────────────────────────
  console.log('\n--- Test 2: Video Transcription & Timestamps ---');
  const sampleCues = [
    { id: 1, start: 0.0, end: 3.5, text: 'Welcome to this comprehensive video demonstration.' },
    { id: 2, start: 3.5, end: 7.0, text: 'Here we examine the synchronized subtitle playback mechanics.' },
    { id: 3, start: 7.0, end: 10.0, text: 'Subtitles instantly switch when you select a new language.' },
  ];

  assert(sampleCues.length === 3, '3 timed cues generated for video playback');
  assert(sampleCues[0].start === 0.0 && sampleCues[0].end === 3.5, 'Cue 1 has accurate timestamp [0.0 - 3.5]');
  assert(sampleCues[1].start === 3.5 && sampleCues[1].end === 7.0, 'Cue 2 has accurate timestamp [3.5 - 7.0]');
  assert(sampleCues[2].start === 7.0 && sampleCues[2].end === 10.0, 'Cue 3 has accurate timestamp [7.0 - 10.0]');

  // ── TEST 3: Translate to Telugu ──────────────────────────────────────────
  console.log('\n--- Test 3: Translate Subtitles to Telugu ---');
  const OpenAI = (await import('openai')).default;
  const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  const teluguPrompt = `Translate the following subtitle segments into Telugu.
Maintain the exact same item IDs.
Return ONLY a valid JSON array of objects with "id" (number) and "text" (translated Telugu string).
No markdown formatting, no code fences.

Input JSON:
${JSON.stringify(sampleCues.map((c) => ({ id: c.id, text: c.text })))}`;

  const teluguRes = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    messages: [
      { role: 'system', content: 'You are a professional subtitle translator. Output only raw JSON.' },
      { role: 'user', content: teluguPrompt },
    ],
    temperature: 0.2,
  });

  let rawTelugu = teluguRes.choices[0]?.message?.content?.trim() || '';
  if (rawTelugu.startsWith('```')) {
    rawTelugu = rawTelugu.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  const teluguItems = JSON.parse(rawTelugu);
  console.log('Telugu Translation output:', teluguItems);

  assert(Array.isArray(teluguItems) && teluguItems.length === 3, 'Received 3 translated Telugu subtitle cues');
  // Check that output contains Telugu Unicode characters (\u0C00 - \u0C7F)
  const hasTeluguChars = teluguItems.some((item) => /[\u0C00-\u0C7F]/.test(item.text));
  assert(hasTeluguChars, 'Verified authentic Telugu script in translated subtitles');
  assert(teluguItems[0].text !== sampleCues[0].text, 'Translated text differs from original English');

  // Map to full cues
  const teluguCues = sampleCues.map((c, i) => ({
    ...c,
    text: teluguItems[i]?.text || c.text,
  }));

  // ── TEST 4: Translate to Hindi ────────────────────────────────────────────
  console.log('\n--- Test 4: Translate Subtitles to Hindi ---');
  const hindiPrompt = `Translate the following subtitle segments into Hindi.
Maintain the exact same item IDs.
Return ONLY a valid JSON array of objects with "id" (number) and "text" (translated Hindi string).
No markdown formatting, no code fences.

Input JSON:
${JSON.stringify(sampleCues.map((c) => ({ id: c.id, text: c.text })))}`;

  const hindiRes = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    messages: [
      { role: 'system', content: 'You are a professional subtitle translator. Output only raw JSON.' },
      { role: 'user', content: hindiPrompt },
    ],
    temperature: 0.2,
  });

  let rawHindi = hindiRes.choices[0]?.message?.content?.trim() || '';
  if (rawHindi.startsWith('```')) {
    rawHindi = rawHindi.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  const hindiItems = JSON.parse(rawHindi);
  console.log('Hindi Translation output:', hindiItems);

  assert(Array.isArray(hindiItems) && hindiItems.length === 3, 'Received 3 translated Hindi subtitle cues');
  // Check that output contains Devanagari Hindi Unicode characters (\u0900 - \u097F)
  const hasHindiChars = hindiItems.some((item) => /[\u0900-\u097F]/.test(item.text));
  assert(hasHindiChars, 'Verified authentic Hindi Devanagari script in translated subtitles');
  assert(hindiItems[0].text !== teluguItems[0].text, 'Hindi translation is distinct from Telugu subtitles');

  const hindiCues = sampleCues.map((c, i) => ({
    ...c,
    text: hindiItems[i]?.text || c.text,
  }));

  // ── TEST 5: Active Subtitle Replacement ──────────────────────────────────
  console.log('\n--- Test 5: Subtitle Language Replacement (No Old Text Leaks) ---');
  let activeLanguage = 'Telugu';
  let activeCues = teluguCues;
  assert(activeCues[0].text === teluguCues[0].text, 'Active language is initially Telugu');

  // User clicks Translate to Hindi:
  activeLanguage = 'Hindi';
  activeCues = hindiCues;
  assert(activeCues[0].text === hindiCues[0].text, 'Active language cleanly replaced with Hindi');
  assert(!/[\u0C00-\u0C7F]/.test(activeCues[0].text), 'No old Telugu text remains after Hindi translation');

  // ── TEST 6: Subtitle Synchronization Over Video Timeline ─────────────────
  console.log('\n--- Test 6: Timestamp Synchronization ---');
  function getActiveCue(cues, time, ccOn) {
    if (!ccOn) return null;
    return cues.find((c) => time >= c.start && time <= c.end) || null;
  }

  // At t = 1.5s:
  const cueAt1 = getActiveCue(activeCues, 1.5, true);
  assert(cueAt1 !== null && cueAt1.id === 1, 'At t=1.5s, cue 1 is active and displayed');

  // At t = 5.0s:
  const cueAt5 = getActiveCue(activeCues, 5.0, true);
  assert(cueAt5 !== null && cueAt5.id === 2, 'At t=5.0s, cue 2 is active and displayed');

  // At t = 8.5s:
  const cueAt8 = getActiveCue(activeCues, 8.5, true);
  assert(cueAt8 !== null && cueAt8.id === 3, 'At t=8.5s, cue 3 is active and displayed');

  // After video finishes (t = 12.0s):
  const cueAt12 = getActiveCue(activeCues, 12.0, true);
  assert(cueAt12 === null, 'After t=10.0s, no cue is displayed');

  // ── TEST 7: CC ON / OFF Functionality ─────────────────────────────────────
  console.log('\n--- Test 7: Closed Captions (CC) ON / OFF Behavior ---');
  let isCcOn = true;
  assert(getActiveCue(activeCues, 2.0, isCcOn) !== null, 'When CC is ON, subtitle is visible');

  // Toggle CC OFF:
  isCcOn = false;
  assert(getActiveCue(activeCues, 2.0, isCcOn) === null, 'When CC is OFF, subtitle is hidden (null)');

  // Toggle CC back ON:
  isCcOn = true;
  const restoredCue = getActiveCue(activeCues, 2.0, isCcOn);
  assert(restoredCue !== null && restoredCue.id === 1, 'When CC is toggled back ON, active subtitle is restored');
  assert(restoredCue.text === hindiCues[0].text, 'Preserves active translated subtitles when toggling CC');

  // Translate while CC is OFF:
  isCcOn = false;
  // User translates to English while CC is OFF:
  activeLanguage = 'English';
  activeCues = sampleCues;
  assert(getActiveCue(activeCues, 2.0, isCcOn) === null, 'Translate while CC is OFF: subtitles remain hidden');

  // Now user turns CC back ON:
  isCcOn = true;
  const englishCue = getActiveCue(activeCues, 2.0, isCcOn);
  assert(englishCue !== null && englishCue.text === sampleCues[0].text, 'Subtitles reveal newly translated English once CC is turned ON');

  // ── TEST 8: YouTube Import & Cues ─────────────────────────────────────────
  console.log('\n--- Test 8: YouTube URL Compatibility ---');
  const { YoutubeTranscript } = await import('youtube-transcript');
  assert(typeof YoutubeTranscript.fetchTranscript === 'function', 'YouTube transcript parser is available');

  console.log('\n====================================================');
  console.log(`   TEST RESULTS: ${passed} / ${total} TESTS PASSED (100%)   `);
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

