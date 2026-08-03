// Formatação inline (negrito/itálico/sublinhado/tamanho de fonte) via marcadores embutidos na
// própria string de enunciado/alternativa — mesma técnica já usada para matemática ($...$), então
// o texto cru continua sendo o único dado persistido/lido pela IA: **negrito**, *itálico*,
// __sublinhado__, [[1.30]]tamanho[[/]]. Cada chamador (MathText.tsx na tela, examPdf.ts no PDF) já
// separa o texto em segmentos matemáticos/não-matemáticos via mathSegments.ts antes de chamar
// parseFormattingRuns — assim um marcador nunca é interpretado dentro de uma fórmula, e uma
// fórmula nunca quebra um marcador aberto (limitação aceita: nenhum marcador atravessa um $...$,
// só é aplicado de cada lado).

export interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  /** Multiplicador de tamanho de fonte só deste trecho (1 = normal) — ver adjustFontScale. */
  fontScale: number;
}

// Marcadores reconhecidos, checados nessa ordem (bold antes de italic para que "**x**" não seja
// lido como itálico de "*x*" sobrando um "*"). Não suporta aninhamento além de uma combinação
// simples de todas as três flags simultâneas (ex: "__**x**__" funciona pois os scanners rodam em
// sequência sobre o texto já parcialmente marcado).
const MARKERS: { open: string; flag: "bold" | "italic" | "underline" }[] = [
  { open: "**", flag: "bold" },
  { open: "__", flag: "underline" },
  { open: "*", flag: "italic" },
];

interface FlatRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

function splitByMarker(runs: FlatRun[], open: string, flag: "bold" | "italic" | "underline"): FlatRun[] {
  const result: FlatRun[] = [];
  for (const run of runs) {
    // Já dentro de uma flag igual não reabre — evita casos degenerados tipo "*a*b*" reinterpretar.
    if (run[flag]) {
      result.push(run);
      continue;
    }
    let rest = run.text;
    while (true) {
      const start = rest.indexOf(open);
      if (start === -1) break;
      const end = rest.indexOf(open, start + open.length);
      if (end === -1) break;
      const before = rest.slice(0, start);
      const inside = rest.slice(start + open.length, end);
      if (inside.length === 0) {
        // Marcador vazio ("****"): trata como texto literal para não sumir com os asteriscos.
        break;
      }
      if (before) result.push({ ...run, text: before });
      result.push({ ...run, text: inside, [flag]: true });
      rest = rest.slice(end + open.length);
    }
    if (rest) result.push({ ...run, text: rest });
  }
  return result;
}

// Marcador de tamanho de fonte: [[1.30]]texto[[/]]. Diferente de bold/italic/underline (flags
// binárias), tamanho é um valor contínuo, então usa um marcador parametrizado em vez do mesmo
// truque de "par de tokens idênticos" — só um nível por vez (não aninha), o que é suficiente já
// que a toolbar sempre ajusta o marcador existente em vez de aninhar um novo (ver adjustFontScale).
const SIZE_MARKER_PATTERN = /\[\[([\d.]+)\]\]([\s\S]*?)\[\[\/\]\]/g;

function splitSizeSegments(text: string): { text: string; fontScale: number }[] {
  const result: { text: string; fontScale: number }[] = [];
  let lastIndex = 0;
  SIZE_MARKER_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SIZE_MARKER_PATTERN.exec(text))) {
    if (match.index > lastIndex) result.push({ text: text.slice(lastIndex, match.index), fontScale: 1 });
    const scale = Number(match[1]);
    if (match[2].length > 0 && Number.isFinite(scale)) {
      result.push({ text: match[2], fontScale: scale });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) result.push({ text: text.slice(lastIndex), fontScale: 1 });
  return result;
}

// Converte um segmento de texto puro (sem $...$) em runs com bold/italic/underline/fontScale
// resolvidos. Tamanho é separado primeiro (marcador externo) e bold/italic/underline resolvidos
// dentro de cada pedaço, para que "aumentar a fonte" de uma seleção que já está em negrito preserve
// o negrito (ex: "[[1.3]]**Pitágoras**[[/]]").
export function parseFormattingRuns(text: string): TextRun[] {
  if (!text) return [];
  const runs: TextRun[] = [];
  for (const sizeChunk of splitSizeSegments(text)) {
    let flat: FlatRun[] = [{ text: sizeChunk.text, bold: false, italic: false, underline: false }];
    for (const { open, flag } of MARKERS) {
      flat = splitByMarker(flat, open, flag);
    }
    for (const run of flat) {
      runs.push({ ...run, fontScale: sizeChunk.fontScale });
    }
  }
  return runs.filter((run) => run.text.length > 0);
}

// Alterna o marcador `open` ao redor do intervalo [start, end) de `text`. Se a seleção já está
// exatamente envolvida pelo marcador, remove; senão, envolve. Retorna o texto resultante e a nova
// seleção (para o textarea recuperar o foco/seleção depois de aplicar). Usado pela mini-toolbar de
// EditableText.tsx.
export function toggleWrap(
  text: string,
  start: number,
  end: number,
  open: string,
): { text: string; selStart: number; selEnd: number } {
  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);

  const alreadyWrapped =
    before.endsWith(open) && after.startsWith(open) && !(selected.startsWith(open) && selected.endsWith(open));

  if (alreadyWrapped) {
    const newBefore = before.slice(0, before.length - open.length);
    const newAfter = after.slice(open.length);
    return {
      text: newBefore + selected + newAfter,
      selStart: newBefore.length,
      selEnd: newBefore.length + selected.length,
    };
  }

  if (selected.startsWith(open) && selected.endsWith(open) && selected.length >= open.length * 2) {
    const inner = selected.slice(open.length, selected.length - open.length);
    return {
      text: before + inner + after,
      selStart: before.length,
      selEnd: before.length + inner.length,
    };
  }

  const placeholder = selected || "texto";
  const wrapped = `${open}${placeholder}${open}`;
  return {
    text: before + wrapped + after,
    selStart: before.length + open.length,
    selEnd: before.length + open.length + placeholder.length,
  };
}

export const FONT_SCALE_MIN = 0.7;
export const FONT_SCALE_MAX = 2.2;
export const FONT_SCALE_STEP = 0.15;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const SIZE_WRAP_PATTERN = /^\[\[([\d.]+)\]\]([\s\S]*)\[\[\/\]\]$/;

// Ajusta o tamanho de fonte só do intervalo [start, end) de `text` em `delta` (positivo = maior,
// negativo = menor), diferente de toggleWrap (bold/italic/underline) porque tamanho é um valor
// contínuo: se a seleção já é exatamente um trecho marcado, ajusta o valor existente (sem aninhar);
// senão, envolve com um marcador novo a partir de 1 (normal) + delta. Volta ao tamanho normal
// (remove o marcador) se o resultado ficar a menos de 0.01 de 1.
export function adjustFontScale(
  text: string,
  start: number,
  end: number,
  delta: number,
): { text: string; selStart: number; selEnd: number } {
  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);

  const existing = selected.match(SIZE_WRAP_PATTERN);
  if (existing) {
    const current = Number(existing[1]);
    const inner = existing[2];
    const next = clamp(current + delta, FONT_SCALE_MIN, FONT_SCALE_MAX);
    if (Math.abs(next - 1) < 0.01) {
      return { text: before + inner + after, selStart: before.length, selEnd: before.length + inner.length };
    }
    const wrapped = `[[${next.toFixed(2)}]]${inner}[[/]]`;
    return { text: before + wrapped + after, selStart: before.length, selEnd: before.length + wrapped.length };
  }

  const placeholder = selected || "texto";
  const next = clamp(1 + delta, FONT_SCALE_MIN, FONT_SCALE_MAX);
  const wrapped = `[[${next.toFixed(2)}]]${placeholder}[[/]]`;
  return { text: before + wrapped + after, selStart: before.length, selEnd: before.length + wrapped.length };
}
