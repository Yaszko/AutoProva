import { HeaderInfo } from '../types';

export function buildExamTitle(header: HeaderInfo): string {
  const tipoLabel = header.tipo === 'recuperacao' ? 'Recuperação' : 'Avaliação';
  const disciplina = header.disciplina.trim();
  const base = disciplina ? `${tipoLabel} de ${disciplina}` : tipoLabel;
  const valor = header.valor.trim();
  return valor ? `${base} - ${valor}` : base;
}
