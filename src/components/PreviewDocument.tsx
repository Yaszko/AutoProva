import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { ExamData, HeaderInfo } from '../types';
import { buildDownloadFileName } from '../lib/fileName';
import { generateExamPdf } from '../lib/pdf/examPdf';
import { SchoolId, SchoolInfo } from '../lib/schoolInfo';
import { ExamPaper, ExamPaperMode } from './ExamPaper';

interface PreviewDocumentProps {
  exam: ExamData;
  header: HeaderInfo;
  schools: Record<SchoolId, SchoolInfo>;
  mode?: ExamPaperMode;
}

export function PreviewDocument({ exam, header, schools, mode = 'prova' }: PreviewDocumentProps) {
  const [generating, setGenerating] = useState(false);

  async function handleDownloadPdf() {
    if (generating) return;
    setGenerating(true);
    try {
      const suffix = mode === 'gabarito' ? 'Gabarito' : undefined;
      await generateExamPdf({
        exam,
        header,
        schools,
        mode,
        fileName: buildDownloadFileName(header, exam, 'pdf', suffix),
      });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <div className="mb-3 flex justify-end lg:shrink-0">
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

      {/* A folha simula um A4 com largura fixa (42rem) — em telas estreitas ela não é espremida,
          e sim scrolada horizontalmente, para não quebrar o layout impresso. */}
      <div className="overflow-x-auto lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        <div className="mx-auto w-full min-w-[42rem] max-w-2xl overflow-hidden rounded-sm shadow-xl">
          <ExamPaper exam={exam} header={header} schools={schools} mode={mode} />
        </div>
      </div>
    </div>
  );
}
