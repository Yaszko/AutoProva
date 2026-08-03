import { forwardRef, useState } from "react";
import { CheckCircle2, Circle, ImagePlus, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { ExamData, HeaderInfo, Questao, TipoQuestao } from "../types";
import { buildExamTitle } from "../lib/examTitle";
import {
  ExamPaperMode,
  LABELS,
  hasMultiplaEscolha,
  formatQuestionNumber,
  isCorrectAlternative,
  normalizeImageSource,
  shouldShowResolucao,
} from "../lib/examContent";
import { resolveLogoSrc, SchoolId, SchoolInfo } from "../lib/schoolInfo";
import { ExamEditorHandlers } from "../hooks/useExamEditor";
import { AiPanel } from "./AiPanel";
import { EditableText } from "./EditableText";
import { ImageEditorModal } from "./ImageEditorModal";
import { MathText } from "./MathText";

export type { ExamPaperMode };

interface ExamPaperProps {
  exam: ExamData;
  header: HeaderInfo;
  schools: Record<SchoolId, SchoolInfo>;
  mode?: ExamPaperMode;
  /** Habilita a edição direto na prévia (usada só na aba "Prévia da Prova"). */
  editable?: boolean;
  editor?: ExamEditorHandlers;
}

function LogoImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-zinc-400 text-center text-[9px] leading-tight text-zinc-500">
        {alt}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-16 w-16 object-contain"
      onError={() => setFailed(true)}
    />
  );
}

const CIRCLED_LETTERS: Record<string, string> = {
  A: "Ⓐ",
  B: "Ⓑ",
  C: "Ⓒ",
  D: "Ⓓ",
};

function LetraBolha({
  letra,
  preenchida,
}: {
  letra: string;
  preenchida: boolean;
}) {
  if (preenchida) {
    return (
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-zinc-900 align-middle text-[9px] font-bold leading-none text-white">
        {letra}
      </span>
    );
  }
  return <span>{CIRCLED_LETTERS[letra] ?? letra}</span>;
}

function GabaritoBox({
  questoes,
  mode,
}: {
  questoes: Questao[];
  mode: ExamPaperMode;
}) {
  return (
    <table className="float-right mb-2 ml-4 border-collapse border border-zinc-400 text-xs">
      <thead>
        <tr>
          <th
            colSpan={2}
            className="border border-zinc-400 bg-zinc-200 px-2 py-1 font-bold"
          >
            {LABELS.gabarito}
          </th>
        </tr>
      </thead>
      <tbody>
        {questoes.map((questao) => (
          <tr key={questao.numero}>
            <td className="border border-zinc-400 px-2 py-1 text-center">
              {formatQuestionNumber(questao.numero)}
            </td>
            <td className="border border-zinc-400 px-2 py-1 text-center text-sm tracking-widest">
              {questao.tipo === "multipla_escolha" ? (
                <span className="inline-flex gap-1">
                  {questao.alternativas.map((alt) => {
                    const letra = alt.letra.toUpperCase();
                    return (
                      <LetraBolha
                        key={letra}
                        letra={letra}
                        preenchida={
                          mode === "gabarito" &&
                          isCorrectAlternative(questao, letra)
                        }
                      />
                    );
                  })}
                </span>
              ) : (
                <span className="italic">{LABELS.dissertativa}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface QuestionBlockProps {
  questao: Questao;
  mode: ExamPaperMode;
  editable: boolean;
  editor?: ExamEditorHandlers;
  canRemove: boolean;
}

function QuestionBlock({ questao, mode, editable, editor, canRemove }: QuestionBlockProps) {
  const [aiOpen, setAiOpen] = useState(false);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const isEditing = editable && Boolean(editor);

  return (
    <li>
      {isEditing && editor && (
        <div className="mb-1 flex items-center justify-end gap-1 opacity-70 transition-opacity hover:opacity-100">
          <select
            value={questao.tipo}
            onChange={(e) => editor.onTipoChange(questao.numero, e.target.value as TipoQuestao)}
            aria-label={`Tipo da questão ${questao.numero}`}
            className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-[10px] text-zinc-600 focus:border-zinc-500 focus:outline-none"
          >
            <option value="multipla_escolha">Múltipla escolha</option>
            <option value="dissertativa">Dissertativa</option>
          </select>
          <button
            type="button"
            onClick={() => setAiOpen((open) => !open)}
            aria-label={`Editar questão ${questao.numero} com IA`}
            title="Editar com IA"
            className={`rounded border border-zinc-300 bg-white p-1 hover:bg-zinc-100 ${aiOpen ? "text-violet-600" : "text-zinc-500"}`}
          >
            <Sparkles size={12} />
          </button>
          <button
            type="button"
            onClick={() => editor.onRemoveQuestao(questao.numero)}
            disabled={!canRemove}
            aria-label={`Remover questão ${questao.numero}`}
            title="Remover questão"
            className="rounded border border-zinc-300 bg-white p-1 text-zinc-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {isEditing && editor ? (
        <p
          className="mb-2"
          style={{ textAlign: questao.enunciadoStyle?.align }}
        >
          <span className="font-semibold">{questao.numero}.</span>{" "}
          <EditableText
            value={questao.enunciado}
            onChange={(value) => editor.onEnunciadoChange(questao.numero, value)}
            placeholder="Escreva o enunciado (use $...$ para matemática)"
            multiline
            ariaLabel={`Enunciado da questão ${questao.numero}`}
            paragraphStyle={questao.enunciadoStyle}
            onParagraphStyleChange={(style) => editor.onEnunciadoStyleChange(questao.numero, style)}
          />
        </p>
      ) : (
        <p
          className="mb-2"
          style={{ textAlign: questao.enunciadoStyle?.align }}
        >
          <span className="font-semibold">{questao.numero}.</span>{" "}
          <MathText text={questao.enunciado} />
        </p>
      )}

      {isEditing && editor ? (
        <div className="mb-2 flex justify-center">
          {questao.imagem ? (
            <div className="group relative inline-block">
              <img
                src={normalizeImageSource(questao.imagem)}
                alt={`Imagem da questão ${questao.numero}`}
                className="max-h-56 max-w-full rounded-md border border-zinc-300 bg-white object-contain"
              />
              <button
                type="button"
                onClick={() => setImageEditorOpen(true)}
                aria-label={`Editar imagem da questão ${questao.numero}`}
                title="Editar imagem"
                className="absolute inset-0 flex items-center justify-center rounded-md text-transparent opacity-0 transition-all hover:bg-black/40 hover:text-white group-hover:opacity-100"
              >
                <Pencil size={20} />
              </button>
              <button
                type="button"
                onClick={() => editor.onImagemChange(questao.numero, "")}
                aria-label={`Remover imagem da questão ${questao.numero}`}
                title="Remover imagem"
                className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-zinc-500 opacity-0 shadow transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setImageEditorOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-400 hover:text-zinc-600"
            >
              <ImagePlus size={14} />
              Adicionar imagem
            </button>
          )}
        </div>
      ) : questao.imagem ? (
        <div className="mb-2 flex justify-center">
          <img
            src={normalizeImageSource(questao.imagem)}
            alt={`Imagem da questão ${questao.numero}`}
            className="max-h-56 max-w-full rounded-md border border-zinc-300 bg-white object-contain"
          />
        </div>
      ) : null}

      {isEditing && editor && imageEditorOpen && (
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

      {questao.tipo === "multipla_escolha" ? (
        <ul className="ml-4 space-y-1">
          {questao.alternativas.map((alt) => {
            if (!isEditing || !editor) {
              return (
                <li key={alt.letra}>
                  {alt.letra.toUpperCase()}) <MathText text={alt.texto} />
                </li>
              );
            }
            const isCorreta = isCorrectAlternative(questao, alt.letra);
            return (
              <li key={alt.letra} className="flex items-start gap-1">
                <button
                  type="button"
                  onClick={() => editor.onRespostaCorretaChange(questao.numero, alt.letra)}
                  aria-label={`Marcar alternativa ${alt.letra.toUpperCase()} como correta`}
                  title="Marcar como resposta correta"
                  className={`mt-0.5 shrink-0 ${isCorreta ? "text-violet-600" : "text-zinc-300 hover:text-zinc-400"}`}
                >
                  {isCorreta ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                </button>
                <span>
                  {alt.letra.toUpperCase()}){" "}
                  <EditableText
                    value={alt.texto}
                    onChange={(value) => editor.onAlternativaChange(questao.numero, alt.letra, value)}
                    placeholder="Texto da alternativa"
                    ariaLabel={`Alternativa ${alt.letra.toUpperCase()} da questão ${questao.numero}`}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      ) : mode === "prova" ? (
        <div className="ml-1 mt-2 space-y-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="border-b border-dotted border-zinc-400"
            />
          ))}
        </div>
      ) : null}

      {shouldShowResolucao(mode) && (
        <p className="ml-1 mt-2 text-red-600">
          <span className="font-semibold">{LABELS.resolucaoPrefix}</span>{" "}
          {questao.resolucao ? (
            <MathText text={questao.resolucao} />
          ) : null}
        </p>
      )}

      {isEditing && editor && aiOpen && (
        <AiPanel
          placeholder="Ex: deixe mais fácil, foque em porcentagem, transforme em dissertativa..."
          submitLabel="Aplicar"
          onSubmit={(instruction) => editor.onAiEditQuestao(questao.numero, instruction)}
          onDone={() => setAiOpen(false)}
        />
      )}
    </li>
  );
}

export const ExamPaper = forwardRef<HTMLDivElement, ExamPaperProps>(
  function ExamPaper({ exam, header, schools, mode = "prova", editable = false, editor }, ref) {
    const escola = schools[header.escola] ?? Object.values(schools)[0];
    const [aiAddOpen, setAiAddOpen] = useState(false);
    const isEditing = editable && mode === "prova" && Boolean(editor);

    return (
      <div ref={ref} className="bg-white p-8 text-zinc-900">
        <div className="relative mb-3 min-h-16">
          {escola.logoEsquerda && (
            <div className="absolute left-0 top-0">
              <LogoImage
                src={resolveLogoSrc(escola.logoEsquerda)}
                alt={`Logo ${escola.nome}`}
              />
            </div>
          )}
          {escola.logoDireita && (
            <div className="absolute right-0 top-0">
              <LogoImage
                src={resolveLogoSrc(escola.logoDireita)}
                alt={`Logo ${escola.nome}`}
              />
            </div>
          )}
          <div className="mx-auto max-w-[calc(100%-9rem)] text-center text-[0.625rem]">
            <p className="text-sm font-bold">{escola.instituicao}</p>
            <p>{escola.endereco}</p>
            <p>
              {LABELS.telefonePrefix} {escola.telefone} &nbsp;&nbsp; {LABELS.emailPrefix} {escola.email}
            </p>
          </div>
        </div>

        <div className="mb-2 flex justify-between text-xs">
          <span>
            <span className="font-semibold">{LABELS.alunoPrefix}</span>{" "}
            <span className="inline-block w-72 border-b border-zinc-400">
              &nbsp;
            </span>
          </span>
          <span>
            <span className="font-semibold">{LABELS.numeroPrefix}</span>{" "}
            <span className="inline-block w-16 border-b border-zinc-400">
              &nbsp;
            </span>
          </span>
        </div>

        <div className="mb-4 flex flex-wrap justify-between gap-2 text-xs">
          <span>
            <span className="font-semibold">{LABELS.professorPrefix}</span>{" "}
            {header.professor || "—"}
          </span>
          <span>
            <span className="font-semibold">{LABELS.dataPrefix}</span> {LABELS.dataPlaceholder}
          </span>
          <span>
            <span className="font-semibold">{LABELS.turmaPrefix}</span> {header.turma || "—"}
          </span>
          <span>
            <span className="font-semibold">{LABELS.notaPrefix}</span>{" "}
            <span className="inline-block w-16 border-b border-zinc-400">
              &nbsp;
            </span>
          </span>
        </div>

        <p className="mb-3 text-sm font-bold">{buildExamTitle(header)}</p>

        <div>
          {hasMultiplaEscolha(exam.questoes) && (
            <GabaritoBox questoes={exam.questoes} mode={mode} />
          )}
          <ol className="list-none space-y-6 text-xs">
            {exam.questoes.map((questao) => (
              <QuestionBlock
                key={questao.numero}
                questao={questao}
                mode={mode}
                editable={isEditing}
                editor={editor}
                canRemove={exam.questoes.length > 1}
              />
            ))}
          </ol>
        </div>

        {isEditing && editor && (
          <div className="mt-6 space-y-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={editor.onAddQuestaoBranco}
                className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-dashed border-zinc-300 px-2 py-1.5 text-xs text-zinc-500 hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
              >
                <Plus size={14} />
                Questão
              </button>
              <button
                type="button"
                onClick={() => setAiAddOpen((open) => !open)}
                className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 py-1.5 text-xs hover:bg-zinc-50 ${
                  aiAddOpen
                    ? "border-violet-400 bg-violet-50 text-violet-700"
                    : "border-dashed border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
                }`}
              >
                <Sparkles size={14} />
                Com IA
              </button>
            </div>
            {aiAddOpen && (
              <AiPanel
                placeholder="Descreva a nova questão. Ex: crie uma questão sobre teorema de Pitágoras, nível fácil"
                submitLabel="Gerar"
                onSubmit={editor.onAiAddQuestao}
                onDone={() => setAiAddOpen(false)}
              />
            )}
          </div>
        )}
      </div>
    );
  },
);
