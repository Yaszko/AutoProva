import { useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy, Download } from 'lucide-react';
import { ExamData, HeaderInfo } from '../types';
import { buildExamTitle } from '../lib/examTitle';
import { buildDownloadFileName } from '../lib/fileName';
import { buildStandaloneHtml } from '../lib/htmlExport';
import { ExamPaper } from './ExamPaper';

interface HtmlCodeViewProps {
  exam: ExamData;
  header: HeaderInfo;
}

export function HtmlCodeView({ exam, header }: HtmlCodeViewProps) {
  const [copied, setCopied] = useState(false);

  const html = useMemo(() => {
    const bodyHtml = renderToStaticMarkup(<ExamPaper exam={exam} header={header} />);
    return buildStandaloneHtml(bodyHtml, buildExamTitle(header));
  }, [exam, header]);

  async function handleCopy() {
    await navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildDownloadFileName(header, exam, 'html');
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copiado!' : 'Copiar HTML'}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          <Download size={14} />
          Baixar .html
        </button>
      </div>
      <div className="min-w-0 overflow-hidden rounded-lg border border-zinc-800">
        <SyntaxHighlighter
          language="markup"
          style={vscDarkPlus}
          codeTagProps={{ style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' } }}
          customStyle={{ margin: 0, fontSize: '0.8rem', maxHeight: '600px' }}
        >
          {html}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
