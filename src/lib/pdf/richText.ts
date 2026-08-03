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
  color?: RgbColor;
  /** Cor usada para procurar a fórmula rasterizada correspondente no cache (ver mathRaster.ts). */
  mathColor?: MathColor;
}

interface WordToken {
  kind: "word";
  text: string;
  bold: boolean;
  italic: boolean;
  color: RgbColor;
  widthMm: number;
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
      color,
      widthMm: doc.getTextWidth(word),
    }));
}

// Converte uma lista de StyledRun (texto comum + segmentos $...$) em uma lista plana de tokens
// (palavra ou imagem de fórmula), na ordem em que devem fluir/quebrar linha.
export function tokenizeRuns(
  doc: jsPDF,
  runs: StyledRun[],
  mathCache: Map<string, RasterizedMath | null>,
  fontSizePt: number,
): LayoutToken[] {
  const tokens: LayoutToken[] = [];

  for (const run of runs) {
    const bold = run.bold ?? false;
    const italic = run.italic ?? false;
    const color = run.color ?? BLACK;
    const mathColor = run.mathColor ?? "black";

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
        tokens.push(...wordTokensFromText(segment, bold, italic, color, doc, fontSizePt));
        continue;
      }

      tokens.push(...wordTokensFromText(segment, bold, italic, color, doc, fontSizePt));
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
  let currentYMm = startYMm;

  function closeLine() {
    if (currentTokens.length === 0) return;
    const mathHeights = currentTokens
      .filter((t): t is MathToken => t.kind === "math")
      .map((t) => t.heightMm);
    const heightMm = Math.max(baseLineHeightMm, ...mathHeights);
    lines.push({ tokens: currentTokens, heightMm });
    currentYMm += heightMm;
    currentTokens = [];
    currentWidthMm = 0;
  }

  for (const token of tokens) {
    const maxWidthMm = getMaxWidthMm(currentYMm);
    if (currentTokens.length > 0 && currentWidthMm + spaceWidthMm + token.widthMm > maxWidthMm) {
      closeLine();
    }
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

export function drawLines(
  doc: jsPDF,
  lines: Line[],
  xMm: number,
  startYMm: number,
  fontSizePt: number,
): number {
  let yMm = startYMm;

  for (const line of lines) {
    let xCursorMm = xMm;
    const baselineMm = yMm + line.heightMm * BASELINE_FRACTION;

    line.tokens.forEach((token, index) => {
      if (index > 0) {
        applyFont(doc, false, false, fontSizePt);
        xCursorMm += doc.getTextWidth(" ");
      }

      if (token.kind === "word") {
        applyFont(doc, token.bold, token.italic, fontSizePt);
        doc.setTextColor(token.color[0], token.color[1], token.color[2]);
        doc.text(token.text, xCursorMm, baselineMm);
        xCursorMm += token.widthMm;
      } else {
        const topMm = baselineMm - token.heightMm * MATH_BASELINE_OFFSET_FRACTION;
        doc.addImage(token.raster.dataUrl, "PNG", xCursorMm, topMm, token.widthMm, token.heightMm);
        xCursorMm += token.widthMm;
      }
    });

    yMm += line.heightMm;
  }

  return yMm;
}
