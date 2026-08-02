import { useRef, useState } from 'react';
import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Download, Loader2 } from 'lucide-react';
import { ExamData, HeaderInfo } from '../types';
import { buildDownloadFileName } from '../lib/fileName';
import { ExamPaper, ExamPaperMode } from './ExamPaper';

const PDF_MARGIN_MM = 10;
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - PDF_MARGIN_MM * 2;
const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - PDF_MARGIN_MM * 2;
const PDF_RENDER_SCALE = 2;

// Top offsets (in canvas px) of elements that should never be split across a page break —
// a break is only ever placed at one of these, never in the middle of a question.
function getPageBreakBoundaries(container: HTMLElement): number[] {
  const containerTop = container.getBoundingClientRect().top;
  const items = container.querySelectorAll('[data-page-break-boundary]');
  const offsets = Array.from(items).map((item) =>
    Math.round((item.getBoundingClientRect().top - containerTop) * PDF_RENDER_SCALE),
  );
  return [0, ...offsets].sort((a, b) => a - b);
}

async function renderElementToPdf(element: HTMLElement, fileName: string) {
  const boundaries = getPageBreakBoundaries(element);
  const canvas = await toCanvas(element, { pixelRatio: PDF_RENDER_SCALE, backgroundColor: '#fafafa' });
  const pxPerMm = canvas.width / CONTENT_WIDTH_MM;
  const pageHeightPx = Math.floor(CONTENT_HEIGHT_MM * pxPerMm);

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageCanvas = document.createElement('canvas');
  const pageCtx = pageCanvas.getContext('2d');
  if (!pageCtx) throw new Error('Não foi possível preparar o canvas de renderização do PDF.');
  pageCanvas.width = canvas.width;

  let renderedPx = 0;
  let pageIndex = 0;
  while (renderedPx < canvas.height) {
    const idealCutoff = Math.min(renderedPx + pageHeightPx, canvas.height);
    let cutoff = idealCutoff;
    if (cutoff < canvas.height) {
      const snapped = boundaries.filter((b) => b > renderedPx && b <= idealCutoff).pop();
      if (snapped) cutoff = snapped;
    }
    const sliceHeightPx = cutoff - renderedPx;

    pageCanvas.height = sliceHeightPx;
    pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
    pageCtx.drawImage(canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

    if (pageIndex > 0) pdf.addPage();
    const sliceHeightMm = sliceHeightPx / pxPerMm;
    pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', PDF_MARGIN_MM, PDF_MARGIN_MM, CONTENT_WIDTH_MM, sliceHeightMm);

    renderedPx = cutoff;
    pageIndex++;
  }

  pdf.save(fileName);
}

interface PreviewDocumentProps {
  exam: ExamData;
  header: HeaderInfo;
  mode?: ExamPaperMode;
}

export function PreviewDocument({ exam, header, mode = 'prova' }: PreviewDocumentProps) {
  const paperRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  async function handleDownloadPdf() {
    if (!paperRef.current || generating) return;
    setGenerating(true);
    try {
      const suffix = mode === 'gabarito' ? 'Gabarito' : undefined;
      await renderElementToPdf(paperRef.current, buildDownloadFileName(header, exam, 'pdf', suffix));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={generating}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {generating ? 'Gerando PDF...' : 'Baixar PDF'}
        </button>
      </div>

      <div className="mx-auto max-w-2xl overflow-hidden rounded-sm shadow-xl">
        <ExamPaper ref={paperRef} exam={exam} header={header} mode={mode} />
      </div>
    </div>
  );
}
