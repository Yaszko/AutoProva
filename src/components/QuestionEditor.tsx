import { useState } from "react";
import { Loader2, Plus, Shapes, Sparkles, X } from "lucide-react";
import { LlmApiError, editQuestion } from "../lib/llmClient";
import { ExamData, LlmProvider, Questao, TipoQuestao } from "../types";
import { ImageEditorModal } from "./ImageEditorModal";

interface QuestionEditorProps {
  exam: ExamData | null;
  onChange: (exam: ExamData) => void;
  provider: LlmProvider;
  apiKey: string;
  model: string;
}

const ALTERNATIVA_LETRAS = ["a", "b", "c", "d"];

function normalizeImageSource(source: string): string {
  const trimmed = source.trim();
  if (trimmed.startsWith("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trimmed)}`;
  }
  return source;
}

function updateQuestao(
  exam: ExamData,
  numero: number,
  updater: (questao: Questao) => Questao,
): ExamData {
  return {
    ...exam,
    questoes: exam.questoes.map((questao) =>
      questao.numero === numero ? updater(questao) : questao,
    ),
  };
}

// Mantém a numeração das questões (e, por consequência, do GABARITO) sempre contígua de 1 a N.
function renumerar(questoes: Questao[]): Questao[] {
  return questoes.map((questao, index) => ({ ...questao, numero: index + 1 }));
}

function addQuestao(
  exam: ExamData,
  questao: Omit<Questao, "numero">,
): ExamData {
  return {
    ...exam,
    questoes: [
      ...exam.questoes,
      { ...questao, numero: exam.questoes.length + 1 },
    ],
  };
}

function removeQuestao(exam: ExamData, numero: number): ExamData {
  return {
    ...exam,
    questoes: renumerar(
      exam.questoes.filter((questao) => questao.numero !== numero),
    ),
  };
}

function errorMessage(err: unknown): string {
  return err instanceof LlmApiError
    ? err.message
    : "Ocorreu um erro inesperado ao consultar a IA.";
}

interface AiPanelProps {
  placeholder: string;
  submitLabel: string;
  onSubmit: (instruction: string) => Promise<void>;
  onDone: () => void;
}

function AiPanel({ placeholder, submitLabel, onSubmit, onDone }: AiPanelProps) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      await onSubmit(instruction);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2 space-y-2 rounded-md border border-violet-800/60 bg-violet-950/20 p-2">
      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder={placeholder}
        rows={2}
        autoFocus
        className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-violet-600 focus:outline-none"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onDone}
          disabled={loading}
          className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 disabled:cursor-not-allowed"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !instruction.trim()}
          className="flex items-center gap-1 rounded-md bg-violet-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Sparkles size={12} />
          )}
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

interface QuestionCardProps {
  questao: Questao;
  canRemove: boolean;
  onTipoChange: (tipo: TipoQuestao) => void;
  onEnunciadoChange: (value: string) => void;
  onImagemChange: (value: string) => void;
  onAlternativaChange: (letra: string, value: string) => void;
  onRespostaCorretaChange: (letra: string) => void;
  onRemove: () => void;
  onAiEdit: (instruction: string) => Promise<void>;
}

function QuestionCard({
  questao,
  canRemove,
  onTipoChange,
  onEnunciadoChange,
  onImagemChange,
  onAlternativaChange,
  onRespostaCorretaChange,
  onRemove,
  onAiEdit,
}: QuestionCardProps) {
  const [aiOpen, setAiOpen] = useState(false);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-zinc-400">
          Questão {questao.numero}
        </span>
        <div className="flex items-center gap-1.5">
          <select
            value={questao.tipo}
            onChange={(e) => onTipoChange(e.target.value as TipoQuestao)}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none"
          >
            <option value="multipla_escolha">Múltipla escolha</option>
            <option value="dissertativa">Dissertativa</option>
          </select>
          <button
            type="button"
            onClick={() => setAiOpen((open) => !open)}
            aria-label={`Editar questão ${questao.numero} com IA`}
            className={`rounded-md p-1 hover:bg-zinc-800 hover:text-violet-400 ${aiOpen ? "bg-zinc-800 text-violet-400" : "text-zinc-500"}`}
          >
            <Sparkles size={14} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={!canRemove}
            aria-label={`Remover questão ${questao.numero}`}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-500"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <textarea
        value={questao.enunciado}
        onChange={(e) => onEnunciadoChange(e.target.value)}
        rows={3}
        className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none"
      />

      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={questao.imagem ?? ""}
            onChange={(e) => onImagemChange(e.target.value)}
            placeholder="URL da imagem (opcional)"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setImageEditorOpen(true)}
            aria-label={`Editor visual de imagem da questão ${questao.numero}`}
            title="Editor visual de imagem"
            className="shrink-0 rounded-md border border-zinc-800 p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-violet-400"
          >
            <Shapes size={14} />
          </button>
        </div>
        {questao.imagem && (
          <img
            src={normalizeImageSource(questao.imagem)}
            alt={`Preview da imagem da questão ${questao.numero}`}
            className="max-h-32 rounded-md border border-zinc-800 bg-zinc-950 object-contain"
          />
        )}
      </div>

      {imageEditorOpen && (
        <ImageEditorModal
          questionNumero={questao.numero}
          initialImage={questao.imagem}
          onSave={(svg) => {
            onImagemChange(svg);
            setImageEditorOpen(false);
          }}
          onClose={() => setImageEditorOpen(false)}
        />
      )}

      {questao.tipo === "multipla_escolha" && (
        <div className="mt-2 space-y-1.5">
          {questao.alternativas.map((alt) => {
            const isCorreta = alt.letra === questao.respostaCorreta;
            return (
              <div key={alt.letra} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name={`resposta-correta-${questao.numero}`}
                  checked={isCorreta}
                  onChange={() => onRespostaCorretaChange(alt.letra)}
                  aria-label={`Marcar alternativa ${alt.letra.toUpperCase()} como correta`}
                  title="Marcar como resposta correta"
                  className="shrink-0 accent-violet-600"
                />
                <span
                  className={`w-4 shrink-0 text-xs font-medium ${isCorreta ? "text-violet-400" : "text-zinc-500"}`}
                >
                  {alt.letra.toUpperCase()})
                </span>
                <input
                  type="text"
                  value={alt.texto}
                  onChange={(e) => onAlternativaChange(alt.letra, e.target.value)}
                  className={`w-full rounded-md border bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none ${isCorreta ? "border-violet-700/70" : "border-zinc-800"}`}
                />
              </div>
            );
          })}
        </div>
      )}

      {aiOpen && (
        <AiPanel
          placeholder="Ex: deixe mais fácil, foque em porcentagem, transforme em dissertativa..."
          submitLabel="Aplicar"
          onSubmit={onAiEdit}
          onDone={() => setAiOpen(false)}
        />
      )}
    </div>
  );
}

export function QuestionEditor({
  exam,
  onChange,
  provider,
  apiKey,
  model,
}: QuestionEditorProps) {
  const [aiAddOpen, setAiAddOpen] = useState(false);

  if (!exam) {
    return (
      <section className="flex min-h-[160px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-center text-sm text-zinc-600 lg:h-full lg:min-h-0">
        Gere uma prova para poder editar as questões e alternativas aqui.
      </section>
    );
  }

  const currentExam = exam;

  function handleTipoChange(numero: number, tipo: TipoQuestao) {
    onChange(
      updateQuestao(currentExam, numero, (questao) => ({
        ...questao,
        tipo,
        alternativas:
          tipo === "dissertativa"
            ? []
            : questao.alternativas.length > 0
              ? questao.alternativas
              : ALTERNATIVA_LETRAS.map((letra) => ({ letra, texto: "" })),
        respostaCorreta: tipo === "dissertativa" ? "" : questao.respostaCorreta,
      })),
    );
  }

  function handleEnunciadoChange(numero: number, enunciado: string) {
    onChange(
      updateQuestao(currentExam, numero, (questao) => ({
        ...questao,
        enunciado,
      })),
    );
  }

  function handleImagemChange(numero: number, imagem: string) {
    onChange(
      updateQuestao(currentExam, numero, (questao) => ({
        ...questao,
        imagem: imagem || undefined,
      })),
    );
  }

  function handleAlternativaChange(
    numero: number,
    letra: string,
    texto: string,
  ) {
    onChange(
      updateQuestao(currentExam, numero, (questao) => ({
        ...questao,
        alternativas: questao.alternativas.map((alt) =>
          alt.letra === letra ? { ...alt, texto } : alt,
        ),
      })),
    );
  }

  function handleRespostaCorretaChange(numero: number, letra: string) {
    onChange(
      updateQuestao(currentExam, numero, (questao) => ({
        ...questao,
        respostaCorreta: letra,
      })),
    );
  }

  function handleRemoveQuestao(numero: number) {
    onChange(removeQuestao(currentExam, numero));
  }

  function handleAddQuestaoBranco() {
    onChange(
      addQuestao(currentExam, {
        tipo: "multipla_escolha",
        enunciado: "",
        alternativas: ALTERNATIVA_LETRAS.map((letra) => ({ letra, texto: "" })),
        respostaCorreta: "",
        resolucao: "",
      }),
    );
  }

  async function handleAiEditQuestao(numero: number, instruction: string) {
    const questaoAtual = currentExam.questoes.find(
      (questao) => questao.numero === numero,
    );
    const result = await editQuestion(provider, apiKey, model, instruction, {
      assunto: currentExam.assunto,
      questaoAtual,
    });
    onChange(
      updateQuestao(currentExam, numero, (questao) => ({
        ...questao,
        ...result,
      })),
    );
  }

  async function handleAiAddQuestao(instruction: string) {
    const result = await editQuestion(provider, apiKey, model, instruction, {
      assunto: currentExam.assunto,
    });
    onChange(addQuestao(currentExam, result));
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden">
      <div className="mb-2 space-y-2 lg:shrink-0">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-300">
          Editar Questões
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleAddQuestaoBranco}
            className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            <Plus size={14} />
            Questão
          </button>
          <button
            type="button"
            onClick={() => setAiAddOpen((open) => !open)}
            className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-xs hover:bg-zinc-800 ${
              aiAddOpen
                ? "border-violet-700 bg-zinc-800 text-violet-400"
                : "border-zinc-700 text-zinc-300"
            }`}
          >
            <Sparkles size={14} />
            Com IA
          </button>
        </div>
      </div>

      {aiAddOpen && (
        <div className="mb-3 shrink-0">
          <AiPanel
            placeholder="Descreva a nova questão. Ex: crie uma questão sobre teorema de Pitágoras, nível fácil"
            submitLabel="Gerar"
            onSubmit={handleAiAddQuestao}
            onDone={() => setAiAddOpen(false)}
          />
        </div>
      )}

      <div className="space-y-4 lg:-mr-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-2">
        {exam.questoes.map((questao) => (
          <QuestionCard
            key={questao.numero}
            questao={questao}
            canRemove={exam.questoes.length > 1}
            onTipoChange={(tipo) => handleTipoChange(questao.numero, tipo)}
            onEnunciadoChange={(value) =>
              handleEnunciadoChange(questao.numero, value)
            }
            onImagemChange={(value) =>
              handleImagemChange(questao.numero, value)
            }
            onAlternativaChange={(letra, value) =>
              handleAlternativaChange(questao.numero, letra, value)
            }
            onRespostaCorretaChange={(letra) =>
              handleRespostaCorretaChange(questao.numero, letra)
            }
            onRemove={() => handleRemoveQuestao(questao.numero)}
            onAiEdit={(instruction) =>
              handleAiEditQuestao(questao.numero, instruction)
            }
          />
        ))}
      </div>
    </section>
  );
}
