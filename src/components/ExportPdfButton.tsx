'use client';

import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  summaryId: string;
  topic: string;
  userName: string;
  searchDate: string;
  markdown: string;
  heading?: string;
  label?: string;
  fileSuffix?: string;
}

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseMarkdownToHtml(md: string): string {
  const lines = md.split('\n');
  const htmlParts: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      if (inList) {
        htmlParts.push('</ul>');
        inList = false;
      }
      continue;
    }

    if (line.startsWith('# ')) {
      if (inList) {
        htmlParts.push('</ul>');
        inList = false;
      }
      const title = line.replace(/^#\s+/, '');
      htmlParts.push(
        `<h1 style="font-size: 16px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #0d9488; padding-bottom: 4px; margin-top: 18px; margin-bottom: 8px;">${escapeHtml(
          title
        )}</h1>`
      );
    } else if (line.startsWith('## ')) {
      if (inList) {
        htmlParts.push('</ul>');
        inList = false;
      }
      const title = line.replace(/^##\s+/, '');
      htmlParts.push(
        `<h2 style="font-size: 13.5px; font-weight: 800; color: #0d9488; margin-top: 14px; margin-bottom: 6px;">${escapeHtml(
          title
        )}</h2>`
      );
    } else if (line.startsWith('### ')) {
      if (inList) {
        htmlParts.push('</ul>');
        inList = false;
      }
      const title = line.replace(/^###\s+/, '');
      htmlParts.push(
        `<h3 style="font-size: 12px; font-weight: 700; color: #334155; margin-top: 10px; margin-bottom: 4px;">${escapeHtml(
          title
        )}</h3>`
      );
    } else if (/^[-*+]\s+/.test(line)) {
      if (!inList) {
        htmlParts.push('<ul style="margin: 4px 0 8px 0; padding-left: 20px; font-size: 11px; line-height: 1.5; color: #1e293b;">');
        inList = true;
      }
      const item = line.replace(/^[-*+]\s+/, '');
      htmlParts.push(`<li style="margin-bottom: 3px;">${escapeHtml(item)}</li>`);
    } else if (/^\d+[.)]\s+/.test(line)) {
      if (inList) {
        htmlParts.push('</ul>');
        inList = false;
      }
      htmlParts.push(
        `<div style="font-size: 11px; line-height: 1.5; color: #1e293b; margin: 4px 0; font-weight: 600;">${escapeHtml(
          line
        )}</div>`
      );
    } else {
      if (inList) {
        htmlParts.push('</ul>');
        inList = false;
      }
      htmlParts.push(
        `<p style="font-size: 11px; line-height: 1.6; color: #334155; margin: 4px 0 8px 0;">${escapeHtml(
          line
        )}</p>`
      );
    }
  }

  if (inList) {
    htmlParts.push('</ul>');
  }

  return htmlParts.join('\n');
}

export function ExportPdfButton({
  summaryId,
  topic,
  userName,
  searchDate,
  markdown,
  heading = 'SynapseTube — Synthesized Study Notes',
  label = 'Export as PDF',
  fileSuffix = 'study-notes',
}: Props) {
  const [busy, setBusy] = useState(false);

  async function exportPdf() {
    setBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      // Render markdown into styled HTML container
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '794px';
      container.style.background = '#ffffff';
      container.style.zIndex = '-9999';

      const commonFont =
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Telugu", "Noto Sans Devanagari", sans-serif';

      // Header block
      const headerHtml = `
        <div style="background: linear-gradient(135deg, #0f766e, #0e7490); color: white; padding: 24px 32px; border-radius: 12px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #5eead4;">
              SynapseTube Study Document
            </div>
            <div style="font-size: 10px; color: #ccfbf1; font-weight: 600;">
              Date: ${escapeHtml(searchDate)}
            </div>
          </div>
          <h1 style="font-size: 20px; font-weight: 800; margin: 0; line-height: 1.3;">
            ${escapeHtml(heading)}
          </h1>
          <div style="font-size: 12px; color: #e2e8f0; margin-top: 8px; display: flex; gap: 16px;">
            <span><strong>Topic:</strong> ${escapeHtml(topic)}</span>
            <span><strong>User:</strong> ${escapeHtml(userName)}</span>
          </div>
        </div>
      `;

      const contentHtml = parseMarkdownToHtml(markdown);

      // Wrapper element with fixed width and padding
      const wrapper = document.createElement('div');
      wrapper.style.cssText = `
        width: 794px;
        padding: 40px 48px;
        box-sizing: border-box;
        background: #ffffff;
        color: #0f172a;
        font-family: ${commonFont};
      `;
      wrapper.innerHTML = `${headerHtml}<div style="line-height: 1.6;">${contentHtml}</div>`;
      container.appendChild(wrapper);
      document.body.appendChild(container);

      try {
        // High-DPI canvas capture
        const canvas = await html2canvas(wrapper, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
        });

        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
          compress: true,
        });

        // A4 page height in canvas px
        const pageHeightPx = Math.floor(canvas.width * (297 / 210));
        let renderedHeight = 0;
        let pageIndex = 0;

        while (renderedHeight < canvas.height) {
          if (pageIndex > 0) doc.addPage('a4', 'portrait');

          const sliceHeight = Math.min(pageHeightPx, canvas.height - renderedHeight);

          // Create temporary slice canvas
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = pageHeightPx;
          const ctx = pageCanvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pageCanvas.width, pageHeightPx);
            ctx.drawImage(
              canvas,
              0,
              renderedHeight,
              canvas.width,
              sliceHeight,
              0,
              0,
              canvas.width,
              sliceHeight
            );

            const imgData = pageCanvas.toDataURL('image/jpeg', 0.95);
            doc.addImage(imgData, 'JPEG', 0, 0, 210, 297);
          }

          renderedHeight += pageHeightPx;
          pageIndex++;
        }

        const safeTopic = topic
          .replace(/[^a-zA-Z0-9_\u0900-\u097F\u0C00-\u0C7F\u4E00-\u9FFF\uAC00-\uD7AF-]+/g, '-')
          .toLowerCase()
          .slice(0, 40);

        doc.save(`${safeTopic}-${fileSuffix}.pdf`);

        // Log the export (RLS: insert own row only)
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('pdf_exports').insert({
            user_id: user.id,
            summary_id: summaryId,
            topic,
          });
        }
      } finally {
        document.body.removeChild(container);
      }
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Could not export PDF. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={exportPdf}
      disabled={busy}
      className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:from-teal-500 hover:to-cyan-500 hover:shadow-glow-sm disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {label}
    </button>
  );
}
