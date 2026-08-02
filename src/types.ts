export interface Alternativa {
  letra: string;
  texto: string;
}

export type TipoQuestao = 'multipla_escolha' | 'dissertativa';

export interface Questao {
  numero: number;
  tipo: TipoQuestao;
  enunciado: string;
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

export type TipoAvaliacao = 'avaliacao' | 'recuperacao';

export interface HeaderInfo {
  professor: string;
  turma: string;
  tipo: TipoAvaliacao;
  valor: string;
}
