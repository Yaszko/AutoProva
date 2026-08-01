import { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { ConfigPanel } from './components/ConfigPanel';
import { HeaderFieldsForm } from './components/HeaderFieldsForm';
import { PromptArea } from './components/PromptArea';
import { ResultPanel } from './components/ResultPanel';
import { QuestionEditor } from './components/QuestionEditor';
import { ErrorAlert } from './components/ErrorAlert';
import { useLocalStorage } from './hooks/useLocalStorage';
import { generateExam, AnthropicApiError } from './lib/anthropicClient';
import { ExamData, HeaderInfo } from './types';

const DEFAULT_HEADER: HeaderInfo = {
  professor: 'Yanko',
  turma: '',
  tipo: 'avaliacao',
  valor: '',
};

export default function App() {
  const [apiKey, setApiKey] = useLocalStorage('autoprova_api_key', '');
  const [model, setModel] = useLocalStorage('autoprova_model', 'claude-sonnet-5');
  const [header, setHeader] = useLocalStorage<HeaderInfo>('autoprova_header_v3', DEFAULT_HEADER);
  const [prompt, setPrompt] = useState('');
  const [numQuestoes, setNumQuestoes] = useState(10);
  const [exam, setExam] = useState<ExamData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleModelChange(nextModel: string) {
    setModel(nextModel);
    setError(null);
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await generateExam(apiKey, model, prompt, numQuestoes);
      setExam(result);
    } catch (err) {
      const message =
        err instanceof AnthropicApiError ? err.message : 'Ocorreu um erro inesperado ao gerar a prova.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-900 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <GraduationCap size={22} />
          <h1 className="text-lg font-semibold">AutoProva</h1>
          <span className="text-sm text-zinc-500">gerador de avaliações com IA</span>
        </div>
      </header>

      <main className="mx-auto max-w-[96rem] px-6 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr] 2xl:grid-cols-[360px_1fr_320px]">
          <div className="space-y-6">
            <ConfigPanel apiKey={apiKey} onApiKeyChange={setApiKey} model={model} onModelChange={handleModelChange} />
            <HeaderFieldsForm value={header} onChange={setHeader} />
            <PromptArea
              prompt={prompt}
              onPromptChange={setPrompt}
              numQuestoes={numQuestoes}
              onNumQuestoesChange={setNumQuestoes}
              onGenerate={handleGenerate}
              loading={loading}
            />
            {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}
          </div>

          <div className="min-w-0">
            <ResultPanel exam={exam} header={header} />
          </div>

          <div className="col-span-full min-w-0 2xl:col-span-1">
            <QuestionEditor exam={exam} onChange={setExam} apiKey={apiKey} model={model} />
          </div>
        </div>
      </main>
    </div>
  );
}
