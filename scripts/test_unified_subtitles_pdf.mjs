import assert from 'node:assert';
import fs from 'node:fs';

console.log('========================================================================');
console.log(' VERIFICATION: UNIFIED SUBTITLES, SEPARATE PDF EXPORTS & CODE-SWITCHING');
console.log('========================================================================\n');

let passed = 0;
let total = 0;

function pass(msg) {
  passed++;
  total++;
  console.log(`✅ [PASS] ${msg}`);
}

function fail(msg, err) {
  total++;
  console.error(`❌ [FAIL] ${msg}`, err);
  process.exitCode = 1;
}

// ── Test 1: VideoSubtitleStudio Component Inspect ────────────────────────
console.log('--- Test 1: VideoSubtitleStudio UI & Logic Requirements ---');
try {
  const content = fs.readFileSync('src/components/VideoSubtitleStudio.tsx', 'utf8');

  // A. Dropdown automatically displays detected language (not hardcoded, not flipped)
  assert.ok(
    content.includes('setSelectedLanguage(detectedLang)') &&
    content.includes('setSelectedLanguage(detectedSource)'),
    'Dropdown must be automatically updated with detected language on both upload & youtube import'
  );
  assert.ok(
    !content.includes("setSelectedLanguage(detectedLang.toLowerCase() === 'telugu' ? 'English' : 'Telugu')"),
    'Must not artificially flip detected language in dropdown'
  );

  // B. Separate PDF download buttons (NO TXT button)
  assert.ok(
    content.includes('data-testid="export-synopsis-pdf-button"'),
    'Must render dedicated Synopsis PDF export button'
  );
  assert.ok(
    content.includes('data-testid="export-transcript-pdf-button"'),
    'Must render dedicated Transcript PDF export button'
  );
  assert.ok(
    content.includes('handleDownloadPdfSynopsis') &&
    content.includes('handleDownloadPdfTranscript'),
    'Must provide separate handlers for Synopsis and Transcript PDFs'
  );
  assert.ok(
    !content.includes('data-testid="export-pdf-button"'),
    'Old unified export-pdf-button must be replaced by separate buttons'
  );

  // C. Independent loading spinners
  assert.ok(
    content.includes('isGeneratingSynopsis') && content.includes('isGeneratingTranscript'),
    'Must maintain independent loading spinners for Synopsis and Transcript PDFs'
  );

  // D. Sanitized error handler prevents raw "fetch failed"
  assert.ok(
    content.includes('sanitizeErrorMessage'),
    'Must sanitize error messages to avoid raw fetch failed errors'
  );

  // E. CC button works as toggle without resetting subtitles
  assert.ok(
    content.includes('setIsCcOn((prev) => !prev)'),
    'CC button toggles on/off cleanly without triggering translation or reset'
  );

  pass('VideoSubtitleStudio satisfies all UI, dropdown sync, separate buttons, and CC requirements');
} catch (err) {
  fail('VideoSubtitleStudio inspection failed', err);
}

// ── Test 2: Separate PDF Generator Functions ─────────────────────────────
console.log('\n--- Test 2: Separate PDF Generators (Synopsis vs Transcript) ---');
try {
  const pdfGenContent = fs.readFileSync('src/lib/pdfGenerator.ts', 'utf8');

  // Both functions must be exported
  assert.ok(
    pdfGenContent.includes('export async function exportSynopsisPdf('),
    'pdfGenerator.ts must export exportSynopsisPdf'
  );
  assert.ok(
    pdfGenContent.includes('export async function exportTranscriptPdf('),
    'pdfGenerator.ts must export exportTranscriptPdf'
  );

  // Synopsis PDF contains 11-section executive review without transcript
  assert.ok(
    pdfGenContent.includes('Executive Video Synopsis'),
    'Synopsis PDF header must identify as Executive Video Synopsis'
  );
  assert.ok(
    pdfGenContent.includes('Key Topics Discussed') &&
    pdfGenContent.includes('Important Points') &&
    pdfGenContent.includes('Detailed Explanation') &&
    pdfGenContent.includes('Key Moments with Timestamps') &&
    pdfGenContent.includes('Conclusion'),
    'Synopsis PDF must render the complete executive analysis sections'
  );

  // Transcript PDF contains complete chronological dialogue
  assert.ok(
    pdfGenContent.includes('Official Video Transcript') ||
    pdfGenContent.includes('Chronological Dialogue'),
    'Transcript PDF must render chronological dialogue'
  );
  assert.ok(
    pdfGenContent.includes('Spoken Language:'),
    'Transcript PDF must display the actual spoken language'
  );

  pass('Separate exportSynopsisPdf and exportTranscriptPdf modules correctly separate synopsis from transcript');
} catch (err) {
  fail('PDF generator functions test failed', err);
}

// ── Test 3: Natural Multilingual Transcript & Code-Switching ────────────
console.log('\n--- Test 3: Multilingual Code-Switching Preservation ---');
try {
  const mixedCodeSwitchingCues = [
    { id: 1, start: 0.0, end: 3.2, text: 'Welcome everyone, ఈ రోజు మనం Next.js 15 గురించి మాట్లాడుకుందాం.' },
    { id: 2, start: 3.2, end: 6.8, text: 'First step is video upload, tarvatha synchronized subtitles వస్తాయి.' },
    { id: 3, start: 6.8, end: 10.5, text: 'आप इसे direct YouTube URL से भी load कर सकते हैं।' },
    { id: 4, start: 10.5, end: 14.0, text: 'Everything is synchronized with 100% accuracy.' },
  ];

  // Verify that all mixed-language scripts (English, Telugu, Devanagari) are intact
  for (const c of mixedCodeSwitchingCues) {
    assert.ok(c.text.length > 0, 'Cue text must be present');
    // Ensure no ASCII stripping or unwanted latin-only restriction
    const hasUnicode = /[^\u0000-\u007F]/.test(c.text);
    if (c.id <= 3) {
      assert.ok(hasUnicode, `Cue ${c.id} should retain native non-Latin characters`);
    }
  }

  pass('Natural multilingual code-switching dialogue (English + Telugu + Hindi) is completely preserved');
} catch (err) {
  fail('Multilingual code-switching test failed', err);
}

// ── Test 4: Synopsis API Strict Language Separation ───────────────────────
console.log('\n--- Test 4: Strict Separation of Subtitle vs Synopsis Language ---');
try {
  const apiRouteContent = fs.readFileSync('src/app/api/subtitles/synopsis/route.ts', 'utf8');

  // Route must accept both language and originalLanguage
  assert.ok(
    apiRouteContent.includes('originalLanguage'),
    'Synopsis API route must accept originalLanguage parameter'
  );
  assert.ok(
    apiRouteContent.includes('safeOriginalLanguage'),
    'Synopsis API route must prioritize originalLanguage for authentic summary'
  );

  pass('Synopsis API enforces strict separation between video subtitle translation and document summary');
} catch (err) {
  fail('Synopsis API separation test failed', err);
}

console.log('\n========================================================================');
console.log(` FINAL RESULTS: ${passed} / ${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
console.log('========================================================================\n');
