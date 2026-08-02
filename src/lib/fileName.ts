import { ExamData, HeaderInfo } from '../types';

const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|]/g;

export function buildDownloadFileName(
  header: HeaderInfo,
  exam: ExamData,
  extension: string,
  suffix?: string,
): string {
  const tipoLabel = header.tipo === 'recuperacao' ? 'Recuperação' : 'Avaliação';
  const parts = [tipoLabel, header.turma.trim(), header.valor.trim()].filter(Boolean).join(' ');
  const assunto = exam.assunto.trim();
  const base = [assunto ? `${parts} - ${assunto}` : parts, suffix].filter(Boolean).join(' - ');

  const safeName = base
    .replace(ILLEGAL_FILENAME_CHARS, '-')
    .replace(/\s+/g, ' ')
    .trim();

  return `${safeName || 'prova'}.${extension}`;
}
