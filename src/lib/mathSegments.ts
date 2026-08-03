// Regra de detecção de matemática compartilhada entre MathText.tsx (prévia em tela, via KaTeX no
// DOM) e o pipeline de exportação de PDF (src/lib/pdf/*, que rasteriza cada fórmula única para
// embutir como imagem em um fluxo de texto vetorial). Manter essa regra em um único lugar evita
// que os dois pipelines divirjam silenciosamente sobre o que conta como um segmento de matemática.
export const MATH_SEGMENT_PATTERN = /(\$[^$]*\$)/g;

export function splitTextSegments(text: string): string[] {
  return text.split(MATH_SEGMENT_PATTERN);
}

export function isMathSegment(segment: string): boolean {
  return segment.startsWith('$') && segment.endsWith('$') && segment.length > 1;
}

export function mathContent(segment: string): string {
  return segment.slice(1, -1);
}
