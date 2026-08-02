import { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { ConfigPanel } from './components/ConfigPanel';
import { HeaderFieldsForm } from './components/HeaderFieldsForm';
import { PromptArea } from './components/PromptArea';
import { ResultPanel } from './components/ResultPanel';
import { QuestionEditor } from './components/QuestionEditor';
import { ErrorAlert } from './components/ErrorAlert';
import { useLocalStorage } from './hooks/useLocalStorage';
import { generateExam, LlmApiError } from './lib/llmClient';
import { defaultModelFor, isValidModelFor } from './lib/llmProviders';
import { ExamData, HeaderInfo, LlmProvider } from './types';

const DEFAULT_HEADER: HeaderInfo = {
  professor: '',
  turma: '',
  tipo: 'avaliacao',
  valor: '',
};

// Migração única: versões anteriores guardavam uma única chave (sempre da Anthropic) sob
// "autoprova_api_key". Reaproveita esse valor como a chave da Anthropic no novo formato
// por provedor, para o professor não precisar digitar a chave de novo.
function legacyAnthropicApiKey(): string {
  try {
    const stored = window.localStorage.getItem('autoprova_api_key');
    return stored !== null ? (JSON.parse(stored) as string) : '';
  } catch {
    return '';
  }
}

const DEFAULT_API_KEYS: Record<LlmProvider, string> = {
  anthropic: legacyAnthropicApiKey(),
  google: '',
};

export default function App() {
  const [provider, setProvider] = useLocalStorage<LlmProvider>('autoprova_provider', 'anthropic');
  const [apiKeys, setApiKeys] = useLocalStorage<Record<LlmProvider, string>>(
    'autoprova_api_keys',
    DEFAULT_API_KEYS,
  );
  const [model, setModel] = useLocalStorage('autoprova_model', defaultModelFor(provider));
  const [header, setHeader] = useLocalStorage<HeaderInfo>('autoprova_header_v3', DEFAULT_HEADER);
  const [prompt, setPrompt] = useState('');
  const [numQuestoes, setNumQuestoes] = useState(10);
  const [exam, setExam] = useState<ExamData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiKey = apiKeys[provider] ?? '';
  const effectiveModel = isValidModelFor(provider, model) ? model : defaultModelFor(provider);

  function handleProviderChange(nextProvider: LlmProvider) {
    setProvider(nextProvider);
    setModel(defaultModelFor(nextProvider));
    setError(null);
  }

  function handleApiKeyChange(nextApiKey: string) {
    setApiKeys({ ...apiKeys, [provider]: nextApiKey });
  }

  function handleModelChange(nextModel: string) {
    setModel(nextModel);
    setError(null);
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await generateExam(provider, apiKey, effectiveModel, prompt, numQuestoes);
      setExam(result);
    } catch (err) {
      const message =
        err instanceof LlmApiError ? err.message : 'Ocorreu um erro inesperado ao gerar a prova.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 lg:h-screen lg:overflow-hidden">
      <header className="shrink-0 border-b border-zinc-900 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <GraduationCap size={22} />
          <h1 className="text-lg font-semibold">AutoProva</h1>
          <span className="hidden text-sm text-zinc-500 sm:inline">gerador de avaliações com IA</span>
        </div>
      </header>

      {/* Abaixo de lg, a página flui e scrola normalmente (melhor para celular). A partir de lg, a
          página fica travada e cada bloco (config, prévia, editor) scrola internamente. */}
      <main className="mx-auto grid w-full max-w-[96rem] grid-cols-1 gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:min-h-0 lg:flex-1 lg:grid-cols-[360px_1fr] lg:grid-rows-[1fr_1fr] lg:overflow-hidden 2xl:grid-cols-[360px_1fr_320px] 2xl:grid-rows-1">
        <div className="space-y-6 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          <ConfigPanel
            provider={provider}
            onProviderChange={handleProviderChange}
            apiKey={apiKey}
            onApiKeyChange={handleApiKeyChange}
            model={effectiveModel}
            onModelChange={handleModelChange}
          />
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

        <div className="min-w-0 lg:min-h-0 lg:overflow-hidden">
          <ResultPanel exam={exam} header={header} />
        </div>

        <div className="col-span-full min-w-0 lg:min-h-0 lg:overflow-hidden 2xl:col-span-1">
          <QuestionEditor
            exam={exam}
            onChange={setExam}
            provider={provider}
            apiKey={apiKey}
            model={effectiveModel}
          />
        </div>
      </main>
    </div>
  );
}
