import { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { ConfigPanel } from './components/ConfigPanel';
import { HeaderFieldsForm } from './components/HeaderFieldsForm';
import { PromptArea } from './components/PromptArea';
import { ResultPanel } from './components/ResultPanel';
import { QuestionEditor } from './components/QuestionEditor';
import { ErrorAlert } from './components/ErrorAlert';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useExamEditor } from './hooks/useExamEditor';
import { generateExam, LlmApiError } from './lib/llmClient';
import { defaultModelFor, isValidModelFor } from './lib/llmProviders';
import { ExamData, HeaderInfo, LlmProvider } from './types';
import { DEFAULT_SCHOOL, SCHOOLS, SchoolId, SchoolInfo } from './lib/schoolInfo';

const DEFAULT_HEADER: HeaderInfo = {
  escola: DEFAULT_SCHOOL,
  professor: '',
  turma: '',
  tipo: 'avaliacao',
  disciplina: '',
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

const HEADER_FIELD_LABELS: [key: keyof Pick<HeaderInfo, 'professor' | 'turma' | 'disciplina' | 'valor'>, label: string][] = [
  ['professor', 'professor(a)'],
  ['turma', 'turma'],
  ['disciplina', 'disciplina'],
  ['valor', 'valor'],
];

// Sem escola padrão, o cabeçalho só fica completo quando o professor preenche tudo (inclusive
// escolhe/cadastra uma escola). Retorna os rótulos, em português, dos campos ainda vazios.
function missingHeaderFields(header: HeaderInfo, schools: Record<SchoolId, SchoolInfo>): string[] {
  const missing: string[] = [];
  if (!header.escola || !schools[header.escola]) missing.push('escola');
  for (const [key, label] of HEADER_FIELD_LABELS) {
    if (!header[key].trim()) missing.push(label);
  }
  return missing;
}

export default function App() {
  const [provider, setProvider] = useLocalStorage<LlmProvider>('autoprova_provider', 'anthropic');
  const [apiKeys, setApiKeys] = useLocalStorage<Record<LlmProvider, string>>(
    'autoprova_api_keys',
    DEFAULT_API_KEYS,
  );
  const [model, setModel] = useLocalStorage('autoprova_model', defaultModelFor(provider));
  const [header, setHeader] = useLocalStorage<HeaderInfo>('autoprova_header_v5', DEFAULT_HEADER);
  const [customSchools, setCustomSchools] = useLocalStorage<Record<SchoolId, SchoolInfo>>(
    'autoprova_custom_schools',
    {},
  );
  const [prompt, setPrompt] = useState('');
  const [numQuestoes, setNumQuestoes] = useState(10);
  const [exam, setExam] = useState<ExamData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiKey = apiKeys[provider] ?? '';
  const effectiveModel = isValidModelFor(provider, model) ? model : defaultModelFor(provider);
  const schools = { ...SCHOOLS, ...customSchools };
  const examEditor = useExamEditor(exam, setExam, provider, apiKey, effectiveModel);

  function handleSaveSchool(id: SchoolId, school: SchoolInfo) {
    setCustomSchools({ ...customSchools, [id]: school });
  }

  function handleRemoveSchool(id: SchoolId) {
    const { [id]: _removed, ...rest } = customSchools;
    setCustomSchools(rest);
    if (header.escola === id) {
      setHeader({ ...header, escola: DEFAULT_SCHOOL });
    }
  }

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
    const missing = missingHeaderFields(header, schools);
    if (missing.length > 0) {
      setError(
        `Preencha os dados do cabeçalho antes de gerar a prova: ${missing.join(', ')}.`,
      );
      return;
    }
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
          página fica travada e cada bloco (config, prévia, editor) scrola internamente. A edição
          das questões tem duas formas equivalentes — direto na prévia (aba "Prévia da Prova",
          WYSIWYG) e neste painel lateral (formulário tradicional) — ambas usam o mesmo
          ExamEditorHandlers, então nunca divergem uma da outra. */}
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
          <HeaderFieldsForm
            value={header}
            onChange={setHeader}
            schools={schools}
            removableSchoolIds={new Set(Object.keys(customSchools))}
            onSaveSchool={handleSaveSchool}
            onRemoveSchool={handleRemoveSchool}
          />
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
          <ResultPanel exam={exam} header={header} schools={schools} editor={examEditor} />
        </div>

        <div className="col-span-full min-w-0 lg:min-h-0 lg:overflow-hidden 2xl:col-span-1">
          <QuestionEditor exam={exam} editor={examEditor} />
        </div>
      </main>
    </div>
  );
}
