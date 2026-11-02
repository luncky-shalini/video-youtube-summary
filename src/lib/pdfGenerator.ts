'use client';

import type { VideoSynopsisData, CueItem } from '@/lib/speakerUtils';
import { normalizeSpeakerLabel } from '@/lib/speakerUtils';

export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(text: string): string {
  const decoded = decodeHtmlEntities(text || '');
  return decoded
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const COMMON_FONT =
  '"Noto Sans Telugu", "Noto Sans Devanagari", "Noto Sans SC", "Noto Sans TC", "Noto Sans KR", "Noto Sans JP", "Noto Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Gautami", "Vani", "Pothana2k", "Nirmala UI", sans-serif';

function ensureFontsLoaded() {
  if (typeof document === 'undefined') return;
  const FONT_ID = 'synapse-pdf-fonts-link';
  if (!document.getElementById(FONT_ID)) {
    const link = document.createElement('link');
    link.id = FONT_ID;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700;800&family=Noto+Sans+Devanagari:wght@400;600;700;800&family=Noto+Sans+JP:wght@400;600;700&family=Noto+Sans+KR:wght@400;600;700&family=Noto+Sans+SC:wght@400;600;700&family=Noto+Sans+Telugu:wght@400;600;700;800&display=swap';
    document.head.appendChild(link);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 1. SYNOPSIS PDF EXPORT (Strictly in Original Video Language)
// ══════════════════════════════════════════════════════════════════════════

export async function exportSynopsisPdf(synopsis: VideoSynopsisData, customFilename?: string) {
  ensureFontsLoaded();
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;

  const totalPages = 3;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-9999';
  container.id = 'synopsis-pdf-render-stage';

  function createHeaderHtml(showHero: boolean, pageNum: number): string {
    if (showHero) {
      return `
        <div style="border-bottom: 2px solid #0d9488; padding-bottom: 14px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="background: linear-gradient(135deg, #0d9488, #06b6d4); color: white; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px;">
                S
              </div>
              <div>
                <span style="font-weight: 900; font-size: 18px; color: #0f172a; letter-spacing: -0.5px;">Synapse<span style="color: #0d9488;">Tube</span></span>
                <span style="font-size: 11px; color: #64748b; margin-left: 8px; font-weight: 600;">Executive Video Synopsis</span>
              </div>
            </div>
            <div style="background: #f0fdfa; border: 1px solid #ccfbf1; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; color: #0f766e;">
              Original Language: ${escapeHtml(synopsis.originalLanguage || synopsis.language)}
            </div>
          </div>
          <h1 style="margin: 14px 0 8px 0; font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.3;">
            ${escapeHtml(synopsis.title)}
          </h1>
          <div style="display: flex; gap: 10px; font-size: 11px; color: #475569; font-weight: 600;">
            <span style="background: #f1f5f9; padding: 3px 8px; border-radius: 6px;">Duration: ${escapeHtml(synopsis.durationFormatted)}</span>
            <span style="background: #f1f5f9; padding: 3px 8px; border-radius: 6px;">Source: ${escapeHtml(synopsis.sourceType)}</span>
            <span style="background: #f1f5f9; padding: 3px 8px; border-radius: 6px;">Generated: ${new Date().toLocaleDateString()}</span>
          </div>
        </div>
      `;
    }
    return `
      <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748b; font-weight: 600;">
        <span style="max-width: 520px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 700; color: #0f172a;">
          ${escapeHtml(synopsis.title)} &bull; ${escapeHtml(synopsis.originalLanguage || synopsis.language)} Synopsis
        </span>
        <span>Page ${pageNum} of ${totalPages}</span>
      </div>
    `;
  }

  function createFooterHtml(pageNum: number): string {
    return `
      <div style="border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: auto; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #94a3b8; font-weight: 600;">
        <span>SynapseTube Video Intelligence &bull; Original Language Synopsis</span>
        <span>Page ${pageNum} of ${totalPages}</span>
      </div>
    `;
  }

  // ── PAGE 1: 1. Executive Summary, 2. Video Overview, 3. Detailed Synopsis ──
  const page1 = document.createElement('div');
  page1.className = 'pdf-page';
  page1.style.cssText = `
    width: 794px;
    height: 1123px;
    box-sizing: border-box;
    padding: 38px 44px;
    background: #ffffff;
    font-family: ${COMMON_FONT};
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  `;
  page1.innerHTML = `
    <div>
      ${createHeaderHtml(true, 1)}

      <!-- Section 1: Executive Summary (ALWAYS IN ENGLISH) -->
      <div style="margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="background: #0d9488; color: white; border-radius: 6px; font-size: 11px; font-weight: 800; padding: 2px 7px;">1</span>
          <h2 style="font-size: 13.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin: 0;">
            Executive Summary
          </h2>
        </div>
        <div style="background: #f0fdfa; border-left: 4px solid #0d9488; border-radius: 0 8px 8px 0; padding: 12px 16px; font-size: 11.5px; line-height: 1.6; color: #134e4a; font-weight: 500;">
          ${escapeHtml(synopsis.executiveSummary || synopsis.overview || '')}
        </div>
      </div>

      <!-- Section 2: Video Overview / Video Details (ALWAYS IN ENGLISH) -->
      <div style="margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="background: #0284c7; color: white; border-radius: 6px; font-size: 11px; font-weight: 800; padding: 2px 7px;">2</span>
          <h2 style="font-size: 13.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin: 0;">
            Video Overview / Video Details
          </h2>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 11px; margin-bottom: 8px;">
          <div>
            <div style="color: #64748b; font-size: 9.5px; font-weight: 700; text-transform: uppercase;">Duration</div>
            <div style="font-weight: 800; color: #0f172a; margin-top: 2px;">${escapeHtml(synopsis.durationFormatted)}</div>
          </div>
          <div>
            <div style="color: #64748b; font-size: 9.5px; font-weight: 700; text-transform: uppercase;">Original Spoken Language</div>
            <div style="font-weight: 800; color: #0d9488; margin-top: 2px;">${escapeHtml(synopsis.originalLanguage || synopsis.language)}</div>
          </div>
          <div>
            <div style="color: #64748b; font-size: 9.5px; font-weight: 700; text-transform: uppercase;">Source Type</div>
            <div style="font-weight: 800; color: #475569; margin-top: 2px;">${escapeHtml(synopsis.sourceType)}</div>
          </div>
        </div>
        ${
          synopsis.videoOverview || synopsis.overview
            ? `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; font-size: 11.5px; line-height: 1.55; color: #334155;">
                ${escapeHtml(synopsis.videoOverview || synopsis.overview || '')}
              </div>`
            : ''
        }
      </div>

      <!-- Section 3: Detailed Synopsis (ALWAYS IN ENGLISH) -->
      <div style="margin-top: 14px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="background: #0d9488; color: white; border-radius: 6px; font-size: 11px; font-weight: 800; padding: 2px 7px;">3</span>
          <h2 style="font-size: 13.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin: 0;">
            Detailed Synopsis
          </h2>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; font-size: 11.5px; line-height: 1.6; color: #334155; white-space: pre-line;">
          ${escapeHtml(synopsis.detailedSynopsis || '')}
        </div>
      </div>
    </div>
    ${createFooterHtml(1)}
  `;
  container.appendChild(page1);

  // ── PAGE 2: 4. Key Topics Covered & 5. Key Moments & Timeline ──────
  const page2 = document.createElement('div');
  page2.className = 'pdf-page';
  page2.style.cssText = `
    width: 794px;
    height: 1123px;
    box-sizing: border-box;
    padding: 38px 44px;
    background: #ffffff;
    font-family: ${COMMON_FONT};
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  `;

  const topicsList = synopsis.keyTopicsCovered || synopsis.keyTopics || [];
  const momentsList = synopsis.keyMomentsTimeline || synopsis.keyMoments || [];
  const charactersList = synopsis.charactersSpeakersDialogue || [];

  page2.innerHTML = `
    <div>
      ${createHeaderHtml(false, 2)}

      <!-- Section 4: Key Topics Covered (ALWAYS IN ENGLISH) -->
      <div style="margin-bottom: 22px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
          <span style="background: #0d9488; color: white; border-radius: 6px; font-size: 11px; font-weight: 800; padding: 2px 7px;">4</span>
          <h2 style="font-size: 13.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin: 0;">
            Key Topics Covered
          </h2>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${
            topicsList.length === 0
              ? `<div style="font-size: 11.5px; color: #64748b;">Key topics covered in the video session.</div>`
              : topicsList
                  .map(
                    (top) => `
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 11px 15px; background: #ffffff;">
              <div style="font-weight: 800; font-size: 12px; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                <span style="width: 7px; height: 7px; border-radius: 50%; background: #0d9488;"></span>
                ${escapeHtml(top.topic)}
              </div>
              <div style="margin-top: 4px; font-size: 11.5px; color: #475569; line-height: 1.55;">
                ${escapeHtml(top.summary)}
              </div>
            </div>
          `
                  )
                  .join('')
          }
        </div>
      </div>

      <!-- Section 5: Key Moments & Timeline (ORIGINAL SPOKEN LANGUAGE & SCRIPT) -->
      <div style="margin-top: 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="background: #0d9488; color: white; border-radius: 6px; font-size: 11px; font-weight: 800; padding: 2px 7px;">5</span>
            <h2 style="font-size: 13.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin: 0;">
              Key Moments & Timeline
            </h2>
          </div>
          <span style="font-size: 10px; color: #0d9488; font-weight: 700;">Original Script (${escapeHtml(synopsis.originalLanguage || synopsis.language)})</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${
            momentsList.length === 0
              ? `<div style="font-size: 11.5px; color: #64748b;">Chronological timeline markers recorded from video.</div>`
              : momentsList
                  .slice(0, 6)
                  .map(
                    (moment: any, mIdx: number) => `
            <div style="display: flex; align-items: baseline; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 13px; font-size: 11.5px; line-height: 1.5;">
              <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; font-weight: 800; color: #0d9488; min-width: 50px; flex-shrink: 0;">
                ${escapeHtml(moment.timestamp || '[00:00]')}
              </span>
              <span style="font-weight: 800; color: #0f172a; min-width: 75px; flex-shrink: 0;">
                ${escapeHtml(normalizeSpeakerLabel(moment.speaker, (mIdx % 2) + 1))}:
              </span>
              <span style="color: #334155; font-weight: 500;">
                ${escapeHtml(moment.dialogueOrEvent || moment.description || '')}
              </span>
            </div>
          `
                  )
                  .join('')
          }
        </div>
      </div>
    </div>
    ${createFooterHtml(2)}
  `;
  container.appendChild(page2);

  // ── PAGE 3: 6. Characters / Speakers & 7. Outcomes & Conclusions ─────
  const page3 = document.createElement('div');
  page3.className = 'pdf-page';
  page3.style.cssText = `
    width: 794px;
    height: 1123px;
    box-sizing: border-box;
    padding: 38px 44px;
    background: #ffffff;
    font-family: ${COMMON_FONT};
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  `;

  page3.innerHTML = `
    <div>
      ${createHeaderHtml(false, 3)}

      <!-- Section 6: Characters / Speakers & Dialogue (ORIGINAL SPOKEN LANGUAGE & SCRIPT) -->
      <div style="margin-bottom: 22px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="background: #0284c7; color: white; border-radius: 6px; font-size: 11px; font-weight: 800; padding: 2px 7px;">6</span>
            <h2 style="font-size: 13.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin: 0;">
              Characters / Speakers & Dialogue
            </h2>
          </div>
          <span style="font-size: 10px; color: #0284c7; font-weight: 700;">English Labels &bull; Original Dialogue (${escapeHtml(synopsis.originalLanguage || synopsis.language)})</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${
            charactersList.length === 0
              ? `<div style="font-size: 11.5px; color: #64748b;">Identified speakers and representative dialogue recorded from video.</div>`
              : charactersList
                  .slice(0, 4)
                  .map(
                    (item: any, cIdx: number) => `
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; font-size: 11.5px; line-height: 1.55;">
              <div style="font-weight: 800; color: #0f172a; margin-bottom: 3px;">
                ${escapeHtml(normalizeSpeakerLabel(item.speaker, (cIdx % 2) + 1))}
              </div>
              <div style="color: #475569; font-style: italic;">
                &ldquo;${escapeHtml(item.dialogue)}&rdquo;
              </div>
            </div>
          `
                  )
                  .join('')
          }
        </div>
      </div>

      <!-- Section 7: Outcomes & Conclusions (ALWAYS IN ENGLISH) -->
      <div style="margin-top: 14px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
          <span style="background: #0d9488; color: white; border-radius: 6px; font-size: 11px; font-weight: 800; padding: 2px 7px;">7</span>
          <h2 style="font-size: 13.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin: 0;">
            Outcomes & Conclusions
          </h2>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; font-size: 12px; line-height: 1.65; color: #1e293b; font-weight: 500;">
          ${escapeHtml(synopsis.outcomesAndConclusions || synopsis.conclusion || '')}
        </div>
      </div>
    </div>
    ${createFooterHtml(3)}
  `;
  container.appendChild(page3);

  document.body.appendChild(container);

  try {
    if (typeof document !== 'undefined' && document.fonts) {
      try {
        await document.fonts.ready;
      } catch {}
    }
    await new Promise((resolve) => setTimeout(resolve, 200));

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageElements = container.querySelectorAll<HTMLElement>('.pdf-page');

    for (let i = 0; i < pageElements.length; i++) {
      if (i > 0) doc.addPage('a4', 'portrait');

      const canvas = await html2canvas(pageElements[i], {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      doc.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    }

    const safeFilename =
      customFilename ||
      `${synopsis.title
        .replace(/[^a-zA-Z0-9_\u0900-\u097F\u0C00-\u0C7F\u4E00-\u9FFF\uAC00-\uD7AF\u3040-\u309F\u30A0-\u30FF-]+/g, '_')
        .slice(0, 40)}_Synopsis.pdf`;

    doc.save(safeFilename);
  } finally {
    document.body.removeChild(container);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 2. TRANSCRIPT PDF EXPORT (Strictly Spoken Words in Native Characters)
// ══════════════════════════════════════════════════════════════════════════

export interface TranscriptPdfParams {
  title: string;
  durationFormatted: string;
  originalLanguage: string;
  sourceType: string;
  cues: CueItem[];
}

export async function exportTranscriptPdf(params: TranscriptPdfParams, customFilename?: string) {
  ensureFontsLoaded();
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;

  const { title, durationFormatted, originalLanguage, sourceType, cues } = params;

  // 14 dialogue segments per page ensures clean vertical breathing room
  const CUES_PER_PAGE = 14;
  const transcriptPages: CueItem[][] = [];
  for (let i = 0; i < cues.length; i += CUES_PER_PAGE) {
    transcriptPages.push(cues.slice(i, i + CUES_PER_PAGE));
  }
  if (transcriptPages.length === 0) {
    transcriptPages.push([]);
  }

  const totalPages = transcriptPages.length;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-9999';
  container.id = 'transcript-pdf-render-stage';

  transcriptPages.forEach((pageCues, idx) => {
    const pageNum = idx + 1;
    const isFirstPage = pageNum === 1;

    const tPage = document.createElement('div');
    tPage.className = 'pdf-page';
    tPage.style.cssText = `
      width: 794px;
      height: 1123px;
      box-sizing: border-box;
      padding: 38px 44px;
      background: #ffffff;
      font-family: ${COMMON_FONT};
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    `;

    const headerHtml = isFirstPage
      ? `
        <div style="border-bottom: 2px solid #0d9488; padding-bottom: 14px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="background: linear-gradient(135deg, #0d9488, #06b6d4); color: white; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px;">
                T
              </div>
              <div>
                <span style="font-weight: 900; font-size: 18px; color: #0f172a; letter-spacing: -0.5px;">Synapse<span style="color: #0d9488;">Tube</span></span>
                <span style="font-size: 11px; color: #64748b; margin-left: 8px; font-weight: 600;">Official Video Transcript</span>
              </div>
            </div>
            <div style="background: #f0fdfa; border: 1px solid #ccfbf1; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; color: #0f766e;">
              Spoken Language: ${escapeHtml(originalLanguage)}
            </div>
          </div>
          <h1 style="margin: 14px 0 8px 0; font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.3;">
            ${escapeHtml(title)}
          </h1>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; gap: 10px; font-size: 11px; color: #475569; font-weight: 600;">
              <span style="background: #f1f5f9; padding: 3px 8px; border-radius: 6px;">Duration: ${escapeHtml(durationFormatted)}</span>
              <span style="background: #f1f5f9; padding: 3px 8px; border-radius: 6px;">Source: ${escapeHtml(sourceType)}</span>
              <span style="background: #f1f5f9; padding: 3px 8px; border-radius: 6px;">Total Cues: ${cues.length}</span>
            </div>
            <span style="font-size: 10px; color: #64748b; font-weight: 600;">Page 1 of ${totalPages}</span>
          </div>
        </div>
      `
      : `
        <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748b; font-weight: 600;">
          <span style="max-width: 520px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 700; color: #0f172a;">
            ${escapeHtml(title)} &bull; ${escapeHtml(originalLanguage)} Transcript
          </span>
          <span>Page ${pageNum} of ${totalPages}</span>
        </div>
      `;

    tPage.innerHTML = `
      <div>
        ${headerHtml}
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="background: #0d9488; color: white; border-radius: 6px; font-size: 10px; font-weight: 800; padding: 2px 6px;">TRANSCRIPT</span>
            <h2 style="font-size: 13px; font-weight: 800; color: #0f172a; letter-spacing: 0.3px; margin: 0;">
              Chronological Dialogue Transcript
            </h2>
          </div>
          <span style="font-size: 10px; color: #64748b; font-weight: 600;">
            Dialogue ${idx * CUES_PER_PAGE + 1} - ${idx * CUES_PER_PAGE + pageCues.length} of ${cues.length}
          </span>
        </div>

        <div style="display: flex; flex-direction: column;">
          ${
            pageCues.length === 0
              ? `<div style="font-size: 12px; color: #64748b; padding: 20px; text-align: center;">No transcript dialogue recorded for this video.</div>`
              : pageCues
                  .map((cue, cIdx) => {
                    const globalIdx = idx * CUES_PER_PAGE + cIdx;
                    const speakerLabel = normalizeSpeakerLabel(cue.speaker, (globalIdx % 2) + 1);
                    const dialogueText = cue.text && cue.text.trim() ? cue.text.trim() : '[Unclear]';
                    return `
              <div style="margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px dashed #e2e8f0;">
                <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; font-weight: 800; color: #0d9488; margin-bottom: 4px;">
                  [${formatTimestamp(cue.start)}] ${escapeHtml(speakerLabel)}
                </div>
                <div style="font-size: 13px; font-weight: 500; color: #0f172a; line-height: 1.6; word-break: break-word;">
                  ${escapeHtml(dialogueText)}
                </div>
              </div>
            `;
                  })
                  .join('')
          }
        </div>
      </div>
      <div style="border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: auto; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #94a3b8; font-weight: 600;">
        <span>SynapseTube Video Intelligence &bull; Official Chronological Transcript</span>
        <span>Page ${pageNum} of ${totalPages}</span>
      </div>
    `;

    container.appendChild(tPage);
  });

  document.body.appendChild(container);

  try {
    if (typeof document !== 'undefined' && document.fonts) {
      try {
        await document.fonts.ready;
      } catch {}
    }
    await new Promise((resolve) => setTimeout(resolve, 200));

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageElements = container.querySelectorAll<HTMLElement>('.pdf-page');

    for (let i = 0; i < pageElements.length; i++) {
      if (i > 0) doc.addPage('a4', 'portrait');

      const canvas = await html2canvas(pageElements[i], {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      doc.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    }

    const safeFilename =
      customFilename ||
      `${title
        .replace(/[^a-zA-Z0-9_\u0900-\u097F\u0C00-\u0C7F\u4E00-\u9FFF\uAC00-\uD7AF\u3040-\u309F\u30A0-\u30FF-]+/g, '_')
        .slice(0, 40)}_Transcript.pdf`;

    doc.save(safeFilename);
  } finally {
    document.body.removeChild(container);
  }
}
