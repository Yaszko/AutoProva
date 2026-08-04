import { useState } from "react";
import { Plus, Shapes, Sparkles, X } from "lucide-react";
import { ExamData, Questao, TipoQuestao } from "../types";
import { isCorrectAlternative, normalizeImageSource } from "../lib/examContent";
import { ExamEditorHandlers } from "../hooks/useExamEditor";
import { AiPanel } from "./AiPanel";
import { ImageEditorModal } from "./ImageEditorModal";

// Painel de edição tradicional (formulário), como alternativa à edição direta na prévia
// (ExamPaper.tsx). Os dois consomem o mesmo ExamEditorHandlers (de useExamEditor.ts) — nenhuma
// lógica de mutação é duplicada aqui, só a apresentação em forma de formulário.
interface QuestionEditorProps {
  exam: ExamData | null;
  editor: ExamEditorHandlers;
}

interface QuestionCardProps {
  questao: Questao;
  canRemove: boolean;
  editor: ExamEditorHandlers;
}

function QuestionCard({ questao, canRemove, editor }: QuestionCardProps) {
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
            onChange={(e) => editor.onTipoChange(questao.numero, e.target.value as TipoQuestao)}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none"
          >
            <option value="multipla_escolha">Múltipla escolha</option>
            <option value="dissertativa">Dissertativa</option>
          </select>
          <button
            type="button"
            onClick={() => setAiOpen((open) => !open)}
            aria-label={`Editar questão ${questao.numero} com IA (editor lateral)`}
            className={`rounded-md p-1 hover:bg-zinc-800 hover:text-violet-400 ${aiOpen ? "bg-zinc-800 text-violet-400" : "text-zinc-500"}`}
          >
            <Sparkles size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.onRemoveQuestao(questao.numero)}
            disabled={!canRemove}
            aria-label={`Remover questão ${questao.numero} (editor lateral)`}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-500"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <textarea
        value={questao.enunciado}
        onChange={(e) => editor.onEnunciadoChange(questao.numero, e.target.value)}
        rows={3}
        aria-label={`Enunciado da questão ${questao.numero} (editor lateral)`}
        className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none"
      />

      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={questao.imagem ?? ""}
            onChange={(e) => editor.onImagemChange(questao.numero, e.target.value)}
            placeholder="URL da imagem (opcional)"
            aria-label={`URL da imagem da questão ${questao.numero} (editor lateral)`}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setImageEditorOpen(true)}
            aria-label={`Editor visual de imagem da questão ${questao.numero} (editor lateral)`}
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
            editor.onImagemChange(questao.numero, svg);
            setImageEditorOpen(false);
          }}
          onClose={() => setImageEditorOpen(false)}
        />
      )}

      {questao.tipo === "multipla_escolha" && (
        <div className="mt-2 space-y-1.5">
          {questao.alternativas.map((alt) => {
            const isCorreta = isCorrectAlternative(questao, alt.letra);
            return (
              <div key={alt.letra} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name={`resposta-correta-lateral-${questao.numero}`}
                  checked={isCorreta}
                  onChange={() => editor.onRespostaCorretaChange(questao.numero, alt.letra)}
                  aria-label={`Marcar alternativa ${alt.letra.toUpperCase()} como correta (editor lateral)`}
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
                  onChange={(e) => editor.onAlternativaChange(questao.numero, alt.letra, e.target.value)}
                  aria-label={`Alternativa ${alt.letra.toUpperCase()} da questão ${questao.numero} (editor lateral)`}
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
          onSubmit={(instruction) => editor.onAiEditQuestao(questao.numero, instruction)}
          onDone={() => setAiOpen(false)}
        />
      )}
    </div>
  );
}

export function QuestionEditor({ exam, editor }: QuestionEditorProps) {
  const [aiAddOpen, setAiAddOpen] = useState(false);

  if (!exam) {
    return (
      <section className="flex min-h-[160px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-center text-sm text-zinc-600 lg:h-full lg:min-h-0">
        Gere uma prova para poder editar as questões e alternativas aqui.
      </section>
    );
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
            onClick={editor.onAddQuestaoBranco}
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
            onSubmit={editor.onAiAddQuestao}
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
            editor={editor}
          />
        ))}
      </div>
    </section>
  );
}
