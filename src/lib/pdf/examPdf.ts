// Orquestrador do PDF vetorial: a única função pública deste módulo é generateExamPdf(). Desenha,
// via chamadas jsPDF, o mesmo conteúdo que ExamPaper.tsx mostra na tela (DOM/CSS) — os dois lados
// compartilham lógica pura e strings via examContent.ts, mas o desenho em si é necessariamente
// duplicado (paradigmas incompatíveis: DOM/CSS vs. primitivas jsPDF).
import { jsPDF } from "jspdf";
import { ExamData, HeaderInfo, Questao } from "../../types";
import { buildExamTitle } from "../examTitle";
import {
  ExamPaperMode,
  LABELS,
  formatQuestionNumber,
  hasMultiplaEscolha,
  isCorrectAlternative,
  normalizeImageSource,
  shouldShowResolucao,
} from "../examContent";
import { SchoolId, SchoolInfo, resolveLogoSrc } from "../schoolInfo";
import { isMathSegment, splitTextSegments } from "../mathSegments";
import { parseFormattingRuns } from "../richTextRuns";
import { RasterImage, rasterizeImageSource } from "./imageRaster";
import { MathColor, RasterizedMath, collectMathEntries, rasterizeMathEntries } from "./mathRaster";
import { RgbColor, StyledRun, drawLines, layoutParagraph, tokenizeRuns } from "./richText";
import { ptToMm } from "./units";

// Converte um campo de texto cru (enunciado/alternativa, podendo conter $...$ e marcadores
// **negrito**/*itálico*/__sublinhado__) em StyledRun[] — mesma ordem de separação que
// MathText.tsx usa na tela (primeiro $...$, só depois os marcadores de formatação dentro de cada
// pedaço não-matemático), para a formatação nunca divergir entre prévia e PDF: um marcador não
// pode atravessar uma fórmula em nenhum dos dois lados.
function styledRunsFromRichText(text: string, color: RgbColor, mathColor: MathColor): StyledRun[] {
  const runs: StyledRun[] = [];
  for (const segment of splitTextSegments(text)) {
    if (segment.length === 0) continue;
    if (isMathSegment(segment)) {
      runs.push({ text: segment, color, mathColor });
      continue;
    }
    for (const run of parseFormattingRuns(segment)) {
      runs.push({
        text: run.text,
        bold: run.bold,
        italic: run.italic,
        underline: run.underline,
        fontScale: run.fontScale,
        color,
        mathColor,
      });
    }
  }
  return runs;
}

export interface GenerateExamPdfOptions {
  exam: ExamData;
  header: HeaderInfo;
  schools: Record<SchoolId, SchoolInfo>;
  mode: ExamPaperMode;
  fileName: string;
}

// --- Geometria da página / tipografia (aproximação em pt/mm das classes Tailwind do ExamPaper) ---
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_MM = 10;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;
const PAGE_BOTTOM_MM = PAGE_HEIGHT_MM - MARGIN_MM;

const FONT_BODY_PT = 9; // text-xs (12px)
const FONT_TITLE_PT = 10.5; // text-sm font-bold (14px)
const FONT_SMALL_PT = 7.5; // text-[0.625rem] (10px)
const FONT_GABARITO_PT = 9;
const FONT_BUBBLE_PT = 6.5;

const TEXT_COLOR: [number, number, number] = [24, 24, 27]; // tailwind zinc-900
const RESOLUCAO_COLOR: [number, number, number] = [220, 38, 38]; // tailwind red-600
const BORDER_COLOR: [number, number, number] = [161, 161, 170]; // tailwind zinc-400
const GABARITO_HEADER_BG: [number, number, number] = [228, 228, 231]; // tailwind zinc-200
const BUBBLE_FILLED_BG: [number, number, number] = [24, 24, 27]; // tailwind zinc-900
const BUBBLE_BORDER_COLOR: [number, number, number] = [113, 113, 122]; // tailwind zinc-500

const PX_TO_MM = 25.4 / 96;
const LOGO_SIZE_MM = 64 * PX_TO_MM; // h-16 w-16
const LOGO_TEXT_GAP_MM = 4;
const HEADER_ROW_HEIGHT_MM = 6;
const ALUNO_LINE_WIDTH_MM = 288 * PX_TO_MM; // w-72
const SHORT_LINE_WIDTH_MM = 64 * PX_TO_MM; // w-16 (nº / Nota)
const IMAGE_MAX_HEIGHT_MM = 224 * PX_TO_MM; // max-h-56

const GAP_MM = 2; // mb-2 / mt-2
const ALT_GAP_MM = 1; // space-y-1
const ALT_INDENT_MM = 16 * PX_TO_MM; // ml-4
const BLANK_INDENT_MM = 4 * PX_TO_MM; // ml-1
const BLANK_ROW_HEIGHT_MM = 6;
const QUESTION_SPACING_MM = 24 * PX_TO_MM; // space-y-6
const GABARITO_GAP_MM = 16 * PX_TO_MM; // ml-4 (float)

const BUBBLE_RADIUS_MM = 1.8;
const BUBBLE_DIAMETER_MM = BUBBLE_RADIUS_MM * 2;
const BUBBLE_GAP_MM = 1.2;
const GABARITO_ROW_HEIGHT_MM = 6;
const GABARITO_HEADER_ROW_HEIGHT_MM = 7;

function fontStyle(bold: boolean, italic: boolean): string {
  if (bold && italic) return "bolditalic";
  if (bold) return "bold";
  if (italic) return "italic";
  return "normal";
}

function setTextStyle(doc: jsPDF, bold: boolean, italic: boolean, sizePt: number, color: [number, number, number]) {
  doc.setFont("helvetica", fontStyle(bold, italic));
  doc.setFontSize(sizePt);
  doc.setTextColor(color[0], color[1], color[2]);
}

function drawCenteredWrapped(doc: jsPDF, text: string, centerXMm: number, maxWidthMm: number, startYMm: number, lineHeightMm: number): number {
  if (!text) return startYMm;
  const lines = doc.splitTextToSize(text, maxWidthMm) as string[];
  let y = startYMm;
  for (const line of lines) {
    doc.text(line, centerXMm, y, { align: "center" });
    y += lineHeightMm;
  }
  return y;
}

function drawHeader(
  doc: jsPDF,
  escola: SchoolInfo,
  logoEsquerda: RasterImage | null,
  logoDireita: RasterImage | null,
  startYMm: number,
): number {
  const logoTopY = startYMm;

  if (logoEsquerda) {
    const w = LOGO_SIZE_MM * (logoEsquerda.widthPx / logoEsquerda.heightPx);
    doc.addImage(logoEsquerda.dataUrl, "PNG", MARGIN_MM, logoTopY, w, LOGO_SIZE_MM);
  }
  if (logoDireita) {
    const w = LOGO_SIZE_MM * (logoDireita.widthPx / logoDireita.heightPx);
    doc.addImage(logoDireita.dataUrl, "PNG", PAGE_WIDTH_MM - MARGIN_MM - w, logoTopY, w, LOGO_SIZE_MM);
  }

  const centerXMm = PAGE_WIDTH_MM / 2;
  const centerMaxWidthMm = CONTENT_WIDTH_MM - 2 * (LOGO_SIZE_MM + LOGO_TEXT_GAP_MM);
  let y = startYMm + ptToMm(FONT_TITLE_PT);

  setTextStyle(doc, true, false, FONT_TITLE_PT, TEXT_COLOR);
  y = drawCenteredWrapped(doc, escola.instituicao, centerXMm, centerMaxWidthMm, y, ptToMm(FONT_TITLE_PT) * 1.25);

  setTextStyle(doc, false, false, FONT_SMALL_PT, TEXT_COLOR);
  y = drawCenteredWrapped(doc, escola.endereco, centerXMm, centerMaxWidthMm, y, ptToMm(FONT_SMALL_PT) * 1.35);

  const contactLine = `${LABELS.telefonePrefix} ${escola.telefone}    ${LABELS.emailPrefix} ${escola.email}`;
  y = drawCenteredWrapped(doc, contactLine, centerXMm, centerMaxWidthMm, y, ptToMm(FONT_SMALL_PT) * 1.35);

  return Math.max(y, logoTopY + LOGO_SIZE_MM) + GAP_MM;
}

function drawAlunoNumeroRow(doc: jsPDF, startYMm: number): number {
  const y = startYMm + ptToMm(FONT_BODY_PT);
  setTextStyle(doc, true, false, FONT_BODY_PT, TEXT_COLOR);
  doc.text(LABELS.alunoPrefix, MARGIN_MM, y);
  const alunoLineStartX = MARGIN_MM + doc.getTextWidth(`${LABELS.alunoPrefix} `);
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
  doc.line(alunoLineStartX, y + 0.8, alunoLineStartX + ALUNO_LINE_WIDTH_MM, y + 0.8);

  const numeroLineEndX = PAGE_WIDTH_MM - MARGIN_MM;
  const numeroLineStartX = numeroLineEndX - SHORT_LINE_WIDTH_MM;
  const numeroLabelX = numeroLineStartX - doc.getTextWidth(`${LABELS.numeroPrefix} `);
  doc.text(LABELS.numeroPrefix, numeroLabelX, y);
  doc.line(numeroLineStartX, y + 0.8, numeroLineEndX, y + 0.8);

  return y + HEADER_ROW_HEIGHT_MM;
}

function drawProfessorRow(doc: jsPDF, header: HeaderInfo, startYMm: number): number {
  const y = startYMm + ptToMm(FONT_BODY_PT);
  const xPositions = [MARGIN_MM, MARGIN_MM + CONTENT_WIDTH_MM * 0.36, MARGIN_MM + CONTENT_WIDTH_MM * 0.62];
  const items: [string, string][] = [
    [LABELS.professorPrefix, header.professor || "—"],
    [LABELS.dataPrefix, LABELS.dataPlaceholder],
    [LABELS.turmaPrefix, header.turma || "—"],
  ];

  items.forEach(([label, value], i) => {
    setTextStyle(doc, true, false, FONT_BODY_PT, TEXT_COLOR);
    doc.text(label, xPositions[i], y);
    const labelWidth = doc.getTextWidth(`${label} `);
    setTextStyle(doc, false, false, FONT_BODY_PT, TEXT_COLOR);
    doc.text(value, xPositions[i] + labelWidth, y);
  });

  const notaLineEndX = PAGE_WIDTH_MM - MARGIN_MM;
  const notaLineStartX = notaLineEndX - SHORT_LINE_WIDTH_MM;
  setTextStyle(doc, true, false, FONT_BODY_PT, TEXT_COLOR);
  const notaLabelX = notaLineStartX - doc.getTextWidth(`${LABELS.notaPrefix} `);
  doc.text(LABELS.notaPrefix, notaLabelX, y);
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
  doc.line(notaLineStartX, y + 0.8, notaLineEndX, y + 0.8);

  return y + HEADER_ROW_HEIGHT_MM + GAP_MM;
}

function drawTitle(doc: jsPDF, header: HeaderInfo, startYMm: number): number {
  const y = startYMm + ptToMm(FONT_TITLE_PT);
  setTextStyle(doc, true, false, FONT_TITLE_PT, TEXT_COLOR);
  doc.text(buildExamTitle(header), MARGIN_MM, y);
  return y + GAP_MM + 1;
}

interface GabaritoLayout {
  widthMm: number;
  heightMm: number;
  numColWidthMm: number;
  answerColWidthMm: number;
}

function computeGabaritoLayout(doc: jsPDF, questoes: Questao[]): GabaritoLayout {
  setTextStyle(doc, false, false, FONT_GABARITO_PT, TEXT_COLOR);
  const numColWidthMm = doc.getTextWidth("00") + 4;

  setTextStyle(doc, false, true, FONT_GABARITO_PT, TEXT_COLOR);
  const dissertativaWidthMm = doc.getTextWidth(LABELS.dissertativa);
  const bubblesWidthMm = 4 * BUBBLE_DIAMETER_MM + 3 * BUBBLE_GAP_MM;
  const answerColWidthMm = Math.max(dissertativaWidthMm, bubblesWidthMm) + 4;

  const widthMm = numColWidthMm + answerColWidthMm;
  const heightMm = GABARITO_HEADER_ROW_HEIGHT_MM + questoes.length * GABARITO_ROW_HEIGHT_MM;
  return { widthMm, heightMm, numColWidthMm, answerColWidthMm };
}

function drawAnswerBubble(doc: jsPDF, letra: string, cxMm: number, cyMm: number, filled: boolean): void {
  if (filled) {
    doc.setFillColor(BUBBLE_FILLED_BG[0], BUBBLE_FILLED_BG[1], BUBBLE_FILLED_BG[2]);
    doc.circle(cxMm, cyMm, BUBBLE_RADIUS_MM, "F");
    doc.setTextColor(255, 255, 255);
  } else {
    doc.setDrawColor(BUBBLE_BORDER_COLOR[0], BUBBLE_BORDER_COLOR[1], BUBBLE_BORDER_COLOR[2]);
    doc.setLineWidth(0.15);
    doc.circle(cxMm, cyMm, BUBBLE_RADIUS_MM, "S");
    doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONT_BUBBLE_PT);
  doc.text(letra, cxMm, cyMm, { align: "center", baseline: "middle" });
}

function drawGabaritoBox(
  doc: jsPDF,
  questoes: Questao[],
  mode: ExamPaperMode,
  layout: GabaritoLayout,
  rightXMm: number,
  topYMm: number,
): void {
  const leftXMm = rightXMm - layout.widthMm;
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
  doc.setLineWidth(0.15);

  doc.setFillColor(GABARITO_HEADER_BG[0], GABARITO_HEADER_BG[1], GABARITO_HEADER_BG[2]);
  doc.rect(leftXMm, topYMm, layout.widthMm, GABARITO_HEADER_ROW_HEIGHT_MM, "FD");
  setTextStyle(doc, true, false, FONT_GABARITO_PT, TEXT_COLOR);
  doc.text(LABELS.gabarito, leftXMm + layout.widthMm / 2, topYMm + GABARITO_HEADER_ROW_HEIGHT_MM / 2, {
    align: "center",
    baseline: "middle",
  });

  let rowY = topYMm + GABARITO_HEADER_ROW_HEIGHT_MM;
  for (const questao of questoes) {
    doc.rect(leftXMm, rowY, layout.numColWidthMm, GABARITO_ROW_HEIGHT_MM, "S");
    doc.rect(leftXMm + layout.numColWidthMm, rowY, layout.answerColWidthMm, GABARITO_ROW_HEIGHT_MM, "S");

    setTextStyle(doc, false, false, FONT_GABARITO_PT, TEXT_COLOR);
    doc.text(formatQuestionNumber(questao.numero), leftXMm + layout.numColWidthMm / 2, rowY + GABARITO_ROW_HEIGHT_MM / 2, {
      align: "center",
      baseline: "middle",
    });

    const answerCenterX = leftXMm + layout.numColWidthMm + layout.answerColWidthMm / 2;
    const answerCenterY = rowY + GABARITO_ROW_HEIGHT_MM / 2;

    if (questao.tipo === "multipla_escolha") {
      const totalWidthMm = 4 * BUBBLE_DIAMETER_MM + 3 * BUBBLE_GAP_MM;
      let bx = answerCenterX - totalWidthMm / 2 + BUBBLE_RADIUS_MM;
      for (const alt of questao.alternativas) {
        const letra = alt.letra.toUpperCase();
        drawAnswerBubble(doc, letra, bx, answerCenterY, mode === "gabarito" && isCorrectAlternative(questao, letra));
        bx += BUBBLE_DIAMETER_MM + BUBBLE_GAP_MM;
      }
    } else {
      setTextStyle(doc, false, true, FONT_GABARITO_PT, TEXT_COLOR);
      doc.text(LABELS.dissertativa, answerCenterX, answerCenterY, { align: "center", baseline: "middle" });
    }

    rowY += GABARITO_ROW_HEIGHT_MM;
  }
}

// Mede (e, se draw=true, desenha) o bloco inteiro de uma questão — enunciado, imagem opcional,
// alternativas/linhas em branco/nada, e resolução (modo gabarito). layoutParagraph nunca desenha
// nada sozinho, então chamá-la aqui sempre (medir E desenhar) não duplica a lógica de quebra de
// linha — só as chamadas de tinta (doc.text/addImage/line) ficam atrás do parâmetro draw.
function measureAndDrawQuestion(
  doc: jsPDF,
  questao: Questao,
  mode: ExamPaperMode,
  mathCache: Map<string, RasterizedMath | null>,
  questionImage: RasterImage | null,
  startYMm: number,
  getMaxWidthMm: (yMm: number) => number,
  draw: boolean,
): number {
  let y = startYMm;

  const enunciadoAlign = questao.enunciadoStyle?.align ?? "left";
  const enunciadoRuns: StyledRun[] = [
    { text: `${questao.numero}.`, bold: true, color: TEXT_COLOR },
    ...styledRunsFromRichText(` ${questao.enunciado}`, TEXT_COLOR, "black"),
  ];
  const enunciadoTokens = tokenizeRuns(doc, enunciadoRuns, mathCache, FONT_BODY_PT);
  const enunciadoLayout = layoutParagraph(doc, enunciadoTokens, y, getMaxWidthMm, FONT_BODY_PT);
  if (draw) drawLines(doc, enunciadoLayout.lines, MARGIN_MM, y, FONT_BODY_PT, enunciadoAlign);
  y += enunciadoLayout.totalHeightMm;

  if (questionImage) {
    y += GAP_MM;
    const maxWidthMm = Math.min(getMaxWidthMm(y), CONTENT_WIDTH_MM);
    const naturalWidthMm = questionImage.widthPx * PX_TO_MM;
    const naturalHeightMm = questionImage.heightPx * PX_TO_MM;
    const scale = Math.min(1, maxWidthMm / naturalWidthMm, IMAGE_MAX_HEIGHT_MM / naturalHeightMm);
    const imgWidthMm = naturalWidthMm * scale;
    const imgHeightMm = naturalHeightMm * scale;
    if (draw) {
      const imgXMm = MARGIN_MM + (CONTENT_WIDTH_MM - imgWidthMm) / 2;
      doc.addImage(questionImage.dataUrl, "PNG", imgXMm, y, imgWidthMm, imgHeightMm);
    }
    y += imgHeightMm;
  }

  if (questao.tipo === "multipla_escolha") {
    y += GAP_MM;
    for (const alt of questao.alternativas) {
      const runs: StyledRun[] = [
        { text: `${alt.letra.toUpperCase()})`, color: TEXT_COLOR },
        ...styledRunsFromRichText(` ${alt.texto}`, TEXT_COLOR, "black"),
      ];
      const tokens = tokenizeRuns(doc, runs, mathCache, FONT_BODY_PT);
      const indentedMaxWidth = (yy: number) => getMaxWidthMm(yy) - ALT_INDENT_MM;
      const layout = layoutParagraph(doc, tokens, y, indentedMaxWidth, FONT_BODY_PT);
      if (draw) drawLines(doc, layout.lines, MARGIN_MM + ALT_INDENT_MM, y, FONT_BODY_PT);
      y += layout.totalHeightMm + ALT_GAP_MM;
    }
    y -= ALT_GAP_MM;
  } else if (mode === "prova") {
    y += GAP_MM;
    if (draw) {
      doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
      doc.setLineDashPattern([0.8, 0.8], 0);
    }
    for (let i = 0; i < 4; i++) {
      if (draw) {
        doc.line(MARGIN_MM + BLANK_INDENT_MM, y, MARGIN_MM + getMaxWidthMm(y), y);
      }
      y += BLANK_ROW_HEIGHT_MM;
    }
    if (draw) doc.setLineDashPattern([], 0);
  }

  if (shouldShowResolucao(mode)) {
    y += GAP_MM;
    const runs: StyledRun[] = [{ text: LABELS.resolucaoPrefix, bold: true, color: RESOLUCAO_COLOR }];
    if (questao.resolucao) {
      runs.push(...styledRunsFromRichText(` ${questao.resolucao}`, RESOLUCAO_COLOR, "red"));
    }
    const tokens = tokenizeRuns(doc, runs, mathCache, FONT_BODY_PT);
    const layout = layoutParagraph(doc, tokens, y, getMaxWidthMm, FONT_BODY_PT);
    if (draw) drawLines(doc, layout.lines, MARGIN_MM, y, FONT_BODY_PT);
    y += layout.totalHeightMm;
  }

  return y - startYMm;
}

export async function generateExamPdf(options: GenerateExamPdfOptions): Promise<void> {
  const { exam, header, schools, mode, fileName } = options;
  const escola = schools[header.escola] ?? Object.values(schools)[0];

  const mathEntries = collectMathEntries(exam, mode);
  const mathCache = await rasterizeMathEntries(mathEntries);

  const logoEsquerda = escola.logoEsquerda
    ? await rasterizeImageSource(resolveLogoSrc(escola.logoEsquerda))
    : null;
  const logoDireita = escola.logoDireita
    ? await rasterizeImageSource(resolveLogoSrc(escola.logoDireita))
    : null;

  const questionImages = new Map<number, RasterImage | null>();
  for (const questao of exam.questoes) {
    if (questao.imagem) {
      questionImages.set(questao.numero, await rasterizeImageSource(normalizeImageSource(questao.imagem)));
    }
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = MARGIN_MM;
  y = drawHeader(doc, escola, logoEsquerda, logoDireita, y);
  y = drawAlunoNumeroRow(doc, y);
  y = drawProfessorRow(doc, header, y);
  y = drawTitle(doc, header, y);

  let exclusion: { bottomYMm: number; widthMm: number } | null = null;
  if (hasMultiplaEscolha(exam.questoes)) {
    const gabaritoLayout = computeGabaritoLayout(doc, exam.questoes);
    const rightXMm = PAGE_WIDTH_MM - MARGIN_MM;
    drawGabaritoBox(doc, exam.questoes, mode, gabaritoLayout, rightXMm, y);
    exclusion = { bottomYMm: y + gabaritoLayout.heightMm, widthMm: gabaritoLayout.widthMm };
  }

  for (const questao of exam.questoes) {
    const getMaxWidthMm = (yy: number) =>
      exclusion && yy < exclusion.bottomYMm
        ? CONTENT_WIDTH_MM - exclusion.widthMm - GABARITO_GAP_MM
        : CONTENT_WIDTH_MM;

    const questionImage = questionImages.get(questao.numero) ?? null;
    let height = measureAndDrawQuestion(doc, questao, mode, mathCache, questionImage, y, getMaxWidthMm, false);

    if (y + height > PAGE_BOTTOM_MM) {
      doc.addPage();
      y = MARGIN_MM;
      exclusion = null;
      height = measureAndDrawQuestion(doc, questao, mode, mathCache, questionImage, y, getMaxWidthMm, false);
    }

    const drawnHeight = measureAndDrawQuestion(doc, questao, mode, mathCache, questionImage, y, getMaxWidthMm, true);
    y += drawnHeight + QUESTION_SPACING_MM;
  }

  doc.save(fileName);
}
