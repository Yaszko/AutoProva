import { SchoolId } from "./lib/schoolInfo";

export type LlmProvider = "anthropic" | "google";

export interface Alternativa {
  letra: string;
  texto: string;
}

export type TipoQuestao = "multipla_escolha" | "dissertativa";

/** Alinhamento de parágrafo do enunciado. Negrito/itálico/sublinhado/tamanho de fonte ficam
 * embutidos no próprio texto via marcadores por trecho (ver richTextRuns.ts) — alinhamento é a
 * única propriedade que faz sentido em nível de parágrafo inteiro. */
export interface TextStyle {
  align?: "left" | "center" | "right";
}

export interface Questao {
  numero: number;
  tipo: TipoQuestao;
  enunciado: string;
  enunciadoStyle?: TextStyle;
  /** URL, data URI ou SVG inline opcional exibido abaixo do enunciado. */
  imagem?: string;
  alternativas: Alternativa[];
  /** Letra (a, b, c ou d) da alternativa correta. Preenchido apenas para questões de múltipla escolha. */
  respostaCorreta: string;
  /** Resolução breve e simplificada, exibida no PDF de gabarito. Preenchida apenas para questões dissertativas. */
  resolucao: string;
}

export interface ExamData {
  assunto: string;
  questoes: Questao[];
}

export type TipoAvaliacao = "avaliacao" | "recuperacao";

export interface HeaderInfo {
  escola: SchoolId;
  professor: string;
  turma: string;
  tipo: TipoAvaliacao;
  disciplina: string;
  valor: string;
}
