import { useState } from 'react';
import { ExamData, HeaderInfo } from '../types';
import { ExamEditorHandlers } from '../hooks/useExamEditor';
import { SchoolId, SchoolInfo } from '../lib/schoolInfo';
import { PreviewDocument } from './PreviewDocument';
import { EmptyState } from './EmptyState';

interface ResultPanelProps {
  exam: ExamData | null;
  header: HeaderInfo;
  schools: Record<SchoolId, SchoolInfo>;
  editor: ExamEditorHandlers;
}

type Tab = 'preview' | 'gabarito';

export function ResultPanel({ exam, header, schools, editor }: ResultPanelProps) {
  const [tab, setTab] = useState<Tab>('preview');

  if (!exam) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 lg:h-full">
        <EmptyState />
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-zinc-800 lg:shrink-0">
        <button
          type="button"
          onClick={() => setTab('preview')}
          className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'preview' ? 'border-b-2 border-zinc-100 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Prévia da Prova
        </button>
        <button
          type="button"
          onClick={() => setTab('gabarito')}
          className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'gabarito' ? 'border-b-2 border-zinc-100 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Prévia do Gabarito
        </button>
      </div>

      <div className="lg:min-h-0 lg:flex-1 lg:overflow-hidden">
        {tab === 'preview' && (
          <PreviewDocument exam={exam} header={header} schools={schools} mode="prova" editable editor={editor} />
        )}
        {tab === 'gabarito' && <PreviewDocument exam={exam} header={header} schools={schools} mode="gabarito" />}
      </div>
    </section>
  );
}
