import { useState } from 'react';
import { ExamData, HeaderInfo } from '../types';
import { PreviewDocument } from './PreviewDocument';
import { HtmlCodeView } from './HtmlCodeView';
import { EmptyState } from './EmptyState';

interface ResultPanelProps {
  exam: ExamData | null;
  header: HeaderInfo;
}

type Tab = 'preview' | 'html';

export function ResultPanel({ exam, header }: ResultPanelProps) {
  const [tab, setTab] = useState<Tab>('preview');

  if (!exam) {
    return (
      <section className="h-full rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <EmptyState />
      </section>
    );
  }

  return (
    <section className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="mb-5 flex gap-1 border-b border-zinc-800">
        <button
          type="button"
          onClick={() => setTab('preview')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'preview' ? 'border-b-2 border-zinc-100 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Prévia do Documento
        </button>
        <button
          type="button"
          onClick={() => setTab('html')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'html' ? 'border-b-2 border-zinc-100 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Código HTML
        </button>
      </div>

      {tab === 'preview' ? <PreviewDocument exam={exam} header={header} /> : <HtmlCodeView exam={exam} header={header} />}
    </section>
  );
}
