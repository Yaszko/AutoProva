// Engine genérico de tokenização + quebra de linha para o PDF vetorial: mistura palavras de texto
// normal (desenhadas com doc.text) com fórmulas matemáticas pré-rasterizadas (desenhadas com
// doc.addImage), quebrando em linhas para caber em uma largura máxima que pode variar por linha
// (usado pela caixa do GABARITO, que "estreita" as primeiras linhas de texto como um float CSS).
// Não tem conhecimento nenhum do domínio da prova — isso fica em examPdf.ts.
import type { jsPDF } from "jspdf";
import { isMathSegment, mathContent, splitTextSegments } from "../mathSegments";
import { entryKey, mathRasterSizeMm, MathColor, RasterizedMath } from "./mathRaster";
import { ptToMm } from "./units";

export type RgbColor = [number, number, number];

export interface StyledRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: RgbColor;
  /** Multiplicador de tamanho de fonte só deste run (1 = tamanho base do parágrafo). */
  fontScale?: number;
  /** Cor usada para procurar a fórmula rasterizada correspondente no cache (ver mathRaster.ts). */
  mathColor?: MathColor;
}

interface WordToken {
  kind: "word";
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: RgbColor;
  widthMm: number;
  /** Tamanho efetivo (já multiplicado por fontScale) usado para desenhar/medir este token. */
  fontSizePt: number;
}

interface MathToken {
  kind: "math";
  raster: RasterizedMath;
  widthMm: number;
  heightMm: number;
}

export type LayoutToken = WordToken | MathToken;

export interface Line {
  tokens: LayoutToken[];
  heightMm: number;
  /** Largura real ocupada pelos tokens da linha (soma de larguras + espaços) — usado para
   * alinhamento centralizado/à direita em drawLines. */
  widthMm: number;
  /** Largura máxima disponível quando essa linha foi montada (pode variar por linha por causa da
   * zona de exclusão do GABARITO) — mesma finalidade de widthMm para calcular o deslocamento. */
  maxWidthMm: number;
}

export interface LayoutResult {
  lines: Line[];
  totalHeightMm: number;
}

const LINE_HEIGHT_MULTIPLIER = 1.35;
const BLACK: RgbColor = [24, 24, 27];

function fontStyle(bold: boolean, italic: boolean): string {
  if (bold && italic) return "bolditalic";
  if (bold) return "bold";
  if (italic) return "italic";
  return "normal";
}

function applyFont(doc: jsPDF, bold: boolean, italic: boolean, fontSizePt: number): void {
  doc.setFont("helvetica", fontStyle(bold, italic));
  doc.setFontSize(fontSizePt);
}

function wordTokensFromText(
  text: string,
  bold: boolean,
  italic: boolean,
  underline: boolean,
  color: RgbColor,
  doc: jsPDF,
  fontSizePt: number,
): WordToken[] {
  applyFont(doc, bold, italic, fontSizePt);
  return text
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => ({
      kind: "word",
      text: word,
      bold,
      italic,
      underline,
      color,
      widthMm: doc.getTextWidth(word),
      fontSizePt,
    }));
}

// Converte uma lista de StyledRun (texto comum + segmentos $...$) em uma lista plana de tokens
// (palavra ou imagem de fórmula), na ordem em que devem fluir/quebrar linha. `baseFontSizePt` é o
// tamanho do parágrafo — cada run pode escalar esse tamanho individualmente via `fontScale` (ver
// StyledRun), então o tamanho efetivo de cada token é calculado aqui, não em examPdf.ts.
export function tokenizeRuns(
  doc: jsPDF,
  runs: StyledRun[],
  mathCache: Map<string, RasterizedMath | null>,
  baseFontSizePt: number,
): LayoutToken[] {
  const tokens: LayoutToken[] = [];

  for (const run of runs) {
    const bold = run.bold ?? false;
    const italic = run.italic ?? false;
    const underline = run.underline ?? false;
    const color = run.color ?? BLACK;
    const mathColor = run.mathColor ?? "black";
    const fontSizePt = baseFontSizePt * (run.fontScale ?? 1);

    for (const segment of splitTextSegments(run.text)) {
      if (segment.length === 0) continue;

      if (isMathSegment(segment)) {
        const raster = mathCache.get(entryKey(mathContent(segment), mathColor));
        if (raster) {
          const { widthMm, heightMm } = mathRasterSizeMm(raster, fontSizePt);
          tokens.push({ kind: "math", raster, widthMm, heightMm });
          continue;
        }
        // Fórmula ausente do cache ou que falhou ao renderizar: mesmo fallback do MathText.tsx —
        // mostra o segmento literal, delimitadores $ inclusos, como texto comum.
        tokens.push(...wordTokensFromText(segment, bold, italic, underline, color, doc, fontSizePt));
        continue;
      }

      tokens.push(...wordTokensFromText(segment, bold, italic, underline, color, doc, fontSizePt));
    }
  }

  return tokens;
}

// Empacota os tokens em linhas respeitando uma largura máxima que pode variar por linha (a função
// é consultada a cada linha, não uma vez só, para permitir tanto a zona de exclusão do GABARITO
// quanto o replanejamento após uma quebra de página). Não desenha nada — só mede — então o mesmo
// resultado serve tanto para decidir se uma questão cabe na página quanto para efetivamente
// desenhá-la (via drawLines), sem duplicar a lógica de quebra.
export function layoutParagraph(
  doc: jsPDF,
  tokens: LayoutToken[],
  startYMm: number,
  getMaxWidthMm: (yMm: number) => number,
  fontSizePt: number,
): LayoutResult {
  const baseLineHeightMm = ptToMm(fontSizePt) * LINE_HEIGHT_MULTIPLIER;
  applyFont(doc, false, false, fontSizePt);
  const spaceWidthMm = doc.getTextWidth(" ");

  const lines: Line[] = [];
  let currentTokens: LayoutToken[] = [];
  let currentWidthMm = 0;
  let currentMaxWidthMm = getMaxWidthMm(startYMm);
  let currentYMm = startYMm;

  function closeLine() {
    if (currentTokens.length === 0) return;
    const mathHeights = currentTokens
      .filter((t): t is MathToken => t.kind === "math")
      .map((t) => t.heightMm);
    // Palavras com fontScale > 1 precisam de uma linha mais alta que o tamanho base do parágrafo.
    const wordLineHeights = currentTokens
      .filter((t): t is WordToken => t.kind === "word")
      .map((t) => ptToMm(t.fontSizePt) * LINE_HEIGHT_MULTIPLIER);
    const heightMm = Math.max(baseLineHeightMm, ...mathHeights, ...wordLineHeights);
    lines.push({ tokens: currentTokens, heightMm, widthMm: currentWidthMm, maxWidthMm: currentMaxWidthMm });
    currentYMm += heightMm;
    currentTokens = [];
    currentWidthMm = 0;
  }

  for (const token of tokens) {
    const maxWidthMm = getMaxWidthMm(currentYMm);
    if (currentTokens.length > 0 && currentWidthMm + spaceWidthMm + token.widthMm > maxWidthMm) {
      closeLine();
    }
    if (currentTokens.length === 0) currentMaxWidthMm = getMaxWidthMm(currentYMm);
    const separatorMm = currentTokens.length > 0 ? spaceWidthMm : 0;
    currentTokens.push(token);
    currentWidthMm += separatorMm + token.widthMm;
  }
  closeLine();

  const totalHeightMm = lines.reduce((sum, line) => sum + line.heightMm, 0);
  return { lines, totalHeightMm };
}

// Baseline aproximada dentro da caixa da linha (fração empírica da altura da linha até a linha de
// base do texto) — usada tanto para posicionar doc.text quanto para alinhar o pé das imagens de
// fórmula ao texto ao redor.
const BASELINE_FRACTION = 0.78;
const MATH_BASELINE_OFFSET_FRACTION = 0.82;

const UNDERLINE_OFFSET_MM = 0.6;

export function drawLines(
  doc: jsPDF,
  lines: Line[],
  xMm: number,
  startYMm: number,
  fontSizePt: number,
  align: "left" | "center" | "right" = "left",
): number {
  let yMm = startYMm;

  for (const line of lines) {
    const alignOffsetMm =
      align === "center" ? (line.maxWidthMm - line.widthMm) / 2 : align === "right" ? line.maxWidthMm - line.widthMm : 0;
    let xCursorMm = xMm + Math.max(0, alignOffsetMm);
    const baselineMm = yMm + line.heightMm * BASELINE_FRACTION;

    // Sequências contíguas de palavras sublinhadas viram um único traço (não um por palavra) para
    // não cortar o sublinhado nos espaços entre elas.
    let underlineStartMm: number | null = null;
    let underlineColor: RgbColor = BLACK;

    function flushUnderline(endMm: number) {
      if (underlineStartMm === null) return;
      doc.setDrawColor(underlineColor[0], underlineColor[1], underlineColor[2]);
      doc.setLineWidth(0.15);
      doc.line(underlineStartMm, baselineMm + UNDERLINE_OFFSET_MM, endMm, baselineMm + UNDERLINE_OFFSET_MM);
      underlineStartMm = null;
    }

    line.tokens.forEach((token, index) => {
      if (index > 0) {
        applyFont(doc, false, false, fontSizePt);
        xCursorMm += doc.getTextWidth(" ");
      }

      if (token.kind === "word") {
        applyFont(doc, token.bold, token.italic, token.fontSizePt);
        doc.setTextColor(token.color[0], token.color[1], token.color[2]);
        doc.text(token.text, xCursorMm, baselineMm);
        if (token.underline) {
          if (underlineStartMm === null) {
            underlineStartMm = xCursorMm;
            underlineColor = token.color;
          }
        } else {
          flushUnderline(xCursorMm);
        }
        xCursorMm += token.widthMm;
      } else {
        flushUnderline(xCursorMm);
        const topMm = baselineMm - token.heightMm * MATH_BASELINE_OFFSET_FRACTION;
        doc.addImage(token.raster.dataUrl, "PNG", xCursorMm, topMm, token.widthMm, token.heightMm);
        xCursorMm += token.widthMm;
      }
    });
    flushUnderline(xCursorMm);

    yMm += line.heightMm;
  }

  return yMm;
}
