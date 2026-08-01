import { HeaderInfo } from '../types';

export function buildExamTitle(header: HeaderInfo): string {
  const tipoLabel = header.tipo === 'recuperacao' ? 'Recuperação' : 'Avaliação';
  const valor = header.valor.trim();
  return valor ? `${tipoLabel} de Matemática - ${valor}` : `${tipoLabel} de Matemática`;
}
