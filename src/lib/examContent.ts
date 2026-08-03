// Lógica pura e strings literais compartilhadas entre a prévia em tela (ExamPaper.tsx, DOM/CSS)
// e o pipeline de exportação de PDF (src/lib/pdf/*, desenho vetorial via jsPDF). Os dois lados
// precisam necessariamente de código de desenho próprio (DOM vs. chamadas jsPDF), mas mantendo a
// lógica de negócio e o texto literal aqui, em um único lugar, os dois não podem divergir sobre
// *o quê* mostrar — apenas sobre *como* desenhar.
import { Questao } from "../types";

export type ExamPaperMode = "prova" | "gabarito";

export const LABELS = {
  gabarito: "GABARITO",
  dissertativa: "dissertativa",
  resolucaoPrefix: "Resolução:",
  alunoPrefix: "Aluno(a):",
  numeroPrefix: "nº",
  professorPrefix: "Professor:",
  dataPrefix: "Data:",
  dataPlaceholder: "____/____/____",
  turmaPrefix: "Turma:",
  notaPrefix: "Nota:",
  telefonePrefix: "Telefone:",
  emailPrefix: "e-mail –",
} as const;

export function hasMultiplaEscolha(questoes: Questao[]): boolean {
  return questoes.some((questao) => questao.tipo === "multipla_escolha");
}

export function formatQuestionNumber(numero: number): string {
  return String(numero).padStart(2, "0");
}

export function isCorrectAlternative(questao: Questao, letra: string): boolean {
  return letra.toUpperCase() === questao.respostaCorreta.toUpperCase();
}

export function shouldShowResolucao(mode: ExamPaperMode): boolean {
  return mode === "gabarito";
}

// Se a imagem da questão vier como marcação <svg> crua (gerada pelo editor visual de imagens ou
// colada manualmente), envolve como data URI para poder ser usada em <img src> ou rasterizada.
export function normalizeImageSource(source: string): string {
  const trimmed = source.trim();
  if (trimmed.startsWith("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trimmed)}`;
  }
  return source;
}
