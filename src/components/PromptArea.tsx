import { Loader2, Sparkles } from 'lucide-react';

const MIN_QUESTOES = 1;
const MAX_QUESTOES = 20;

interface PromptAreaProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  numQuestoes: number;
  onNumQuestoesChange: (value: number) => void;
  onGenerate: () => void;
  loading: boolean;
}

export function PromptArea({
  prompt,
  onPromptChange,
  numQuestoes,
  onNumQuestoesChange,
  onGenerate,
  loading,
}: PromptAreaProps) {
  function handleNumQuestoesChange(rawValue: string) {
    const parsed = Math.round(Number(rawValue));
    if (Number.isNaN(parsed)) return;
    onNumQuestoesChange(Math.min(MAX_QUESTOES, Math.max(MIN_QUESTOES, parsed)));
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-300">Criação da Prova</h2>

      <div className="mb-3">
        <label htmlFor="num-questoes" className="mb-1.5 block text-xs text-zinc-400">
          Número de questões
        </label>
        <input
          id="num-questoes"
          type="number"
          min={MIN_QUESTOES}
          max={MAX_QUESTOES}
          value={numQuestoes}
          onChange={(e) => handleNumQuestoesChange(e.target.value)}
          className="w-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
        />
      </div>

      <textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder="Descreva o assunto, o nível de dificuldade e orientações para a prova. Ex: Prova de Biologia sobre citologia para o 1º ano do Ensino Médio, nível médio de dificuldade, misturando questões objetivas e dissertativas."
        rows={6}
        className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
      />
      <button
        type="button"
        onClick={onGenerate}
        disabled={loading || !prompt.trim()}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Gerando prova...
          </>
        ) : (
          <>
            <Sparkles size={16} />
            Gerar Prova ({numQuestoes} {numQuestoes === 1 ? 'Questão' : 'Questões'})
          </>
        )}
      </button>
    </section>
  );
}
