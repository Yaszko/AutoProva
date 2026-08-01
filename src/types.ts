export interface Alternativa {
  letra: string;
  texto: string;
}

export type TipoQuestao = 'multipla_escolha' | 'dissertativa';

export interface Questao {
  numero: number;
  tipo: TipoQuestao;
  enunciado: string;
  alternativas: Alternativa[];
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
