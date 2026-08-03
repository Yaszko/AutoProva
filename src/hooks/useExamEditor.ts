// Toda a lógica de mutação de uma prova (adicionar/remover/editar questão, alternativas, tipo,
// resposta correta, imagem, edição via IA) vivia antes só em QuestionEditor.tsx. Foi extraída para
// cá para que a edição possa acontecer direto na prévia (ExamPaper.tsx), sem duplicar essa lógica.
import { editQuestion } from "../lib/llmClient";
import { ExamData, LlmProvider, Questao, TextStyle, TipoQuestao } from "../types";

const ALTERNATIVA_LETRAS = ["a", "b", "c", "d"];

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

function addQuestao(exam: ExamData, questao: Omit<Questao, "numero">): ExamData {
  return {
    ...exam,
    questoes: [...exam.questoes, { ...questao, numero: exam.questoes.length + 1 }],
  };
}

function removeQuestao(exam: ExamData, numero: number): ExamData {
  return {
    ...exam,
    questoes: renumerar(exam.questoes.filter((questao) => questao.numero !== numero)),
  };
}

export interface ExamEditorHandlers {
  onTipoChange(numero: number, tipo: TipoQuestao): void;
  onEnunciadoChange(numero: number, value: string): void;
  onEnunciadoStyleChange(numero: number, style: TextStyle): void;
  onImagemChange(numero: number, value: string): void;
  onAlternativaChange(numero: number, letra: string, value: string): void;
  onRespostaCorretaChange(numero: number, letra: string): void;
  onRemoveQuestao(numero: number): void;
  onAddQuestaoBranco(): void;
  onAiEditQuestao(numero: number, instruction: string): Promise<void>;
  onAiAddQuestao(instruction: string): Promise<void>;
}

export function useExamEditor(
  exam: ExamData | null,
  onChange: (exam: ExamData) => void,
  provider: LlmProvider,
  apiKey: string,
  model: string,
): ExamEditorHandlers {
  function onTipoChange(numero: number, tipo: TipoQuestao) {
    if (!exam) return;
    onChange(
      updateQuestao(exam, numero, (questao) => ({
        ...questao,
        tipo,
        // Alternativas/respostaCorreta só são lidas/exibidas quando tipo === "multipla_escolha"
        // (ver ExamPaper.tsx e examPdf.ts) — preservá-las mesmo em dissertativa evita perder o
        // conteúdo já digitado se o professor voltar para múltipla escolha depois.
        alternativas:
          questao.alternativas.length > 0
            ? questao.alternativas
            : ALTERNATIVA_LETRAS.map((letra) => ({ letra, texto: "" })),
      })),
    );
  }

  function onEnunciadoChange(numero: number, enunciado: string) {
    if (!exam) return;
    onChange(updateQuestao(exam, numero, (questao) => ({ ...questao, enunciado })));
  }

  function onEnunciadoStyleChange(numero: number, style: TextStyle) {
    if (!exam) return;
    onChange(updateQuestao(exam, numero, (questao) => ({ ...questao, enunciadoStyle: style })));
  }

  function onImagemChange(numero: number, imagem: string) {
    if (!exam) return;
    onChange(
      updateQuestao(exam, numero, (questao) => ({
        ...questao,
        imagem: imagem || undefined,
      })),
    );
  }

  function onAlternativaChange(numero: number, letra: string, texto: string) {
    if (!exam) return;
    onChange(
      updateQuestao(exam, numero, (questao) => ({
        ...questao,
        alternativas: questao.alternativas.map((alt) =>
          alt.letra === letra ? { ...alt, texto } : alt,
        ),
      })),
    );
  }

  function onRespostaCorretaChange(numero: number, letra: string) {
    if (!exam) return;
    onChange(updateQuestao(exam, numero, (questao) => ({ ...questao, respostaCorreta: letra })));
  }

  function onRemoveQuestao(numero: number) {
    if (!exam) return;
    onChange(removeQuestao(exam, numero));
  }

  function onAddQuestaoBranco() {
    if (!exam) return;
    onChange(
      addQuestao(exam, {
        tipo: "multipla_escolha",
        enunciado: "",
        alternativas: ALTERNATIVA_LETRAS.map((letra) => ({ letra, texto: "" })),
        respostaCorreta: "",
        resolucao: "",
      }),
    );
  }

  async function onAiEditQuestao(numero: number, instruction: string) {
    if (!exam) return;
    const questaoAtual = exam.questoes.find((questao) => questao.numero === numero);
    const result = await editQuestion(provider, apiKey, model, instruction, {
      assunto: exam.assunto,
      questaoAtual,
    });
    onChange(updateQuestao(exam, numero, (questao) => ({ ...questao, ...result })));
  }

  async function onAiAddQuestao(instruction: string) {
    if (!exam) return;
    const result = await editQuestion(provider, apiKey, model, instruction, {
      assunto: exam.assunto,
    });
    onChange(addQuestao(exam, result));
  }

  return {
    onTipoChange,
    onEnunciadoChange,
    onEnunciadoStyleChange,
    onImagemChange,
    onAlternativaChange,
    onRespostaCorretaChange,
    onRemoveQuestao,
    onAddQuestaoBranco,
    onAiEditQuestao,
    onAiAddQuestao,
  };
}
