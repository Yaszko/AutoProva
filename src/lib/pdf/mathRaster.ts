// Rasteriza cada fórmula $...$ única do exame (enunciados, alternativas, resolução) para PNG, para
// embutir como imagem inline dentro do fluxo de texto vetorial do PDF (jsPDF não desenha o
// HTML/CSS que o KaTeX produz — só texto vetorial ou imagens raster). Reaproveita html-to-image
// (já usado no app) em vez de introduzir uma nova dependência: renderiza o KaTeX em um único
// container oculto reaproveitado e tira um "screenshot" (toCanvas) só daquele pedaço pequeno.
import katex from "katex";
import { toCanvas } from "html-to-image";
import { ExamData } from "../../types";
import { ExamPaperMode, shouldShowResolucao } from "../examContent";
import { isMathSegment, mathContent, splitTextSegments } from "../mathSegments";
import { PT_TO_MM } from "./units";

export type MathColor = "black" | "red";

export interface RasterizedMath {
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  refFontPx: number;
}

export interface MathEntry {
  key: string;
  latex: string;
  color: MathColor;
}

const REF_FONT_PX = 32;
const RASTER_PIXEL_RATIO = 3;
const COLOR_HEX: Record<MathColor, string> = {
  black: "#000000",
  red: "#dc2626",
};

export function entryKey(latex: string, color: MathColor): string {
  return `${color}|${latex}`;
}

function collectFromText(text: string, color: MathColor, seen: Set<string>, entries: MathEntry[]) {
  for (const segment of splitTextSegments(text)) {
    if (!isMathSegment(segment)) continue;
    const latex = mathContent(segment);
    const key = entryKey(latex, color);
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ key, latex, color });
  }
}

export function collectMathEntries(exam: ExamData, mode: ExamPaperMode): MathEntry[] {
  const seen = new Set<string>();
  const entries: MathEntry[] = [];

  for (const questao of exam.questoes) {
    collectFromText(questao.enunciado, "black", seen, entries);
    for (const alt of questao.alternativas) {
      collectFromText(alt.texto, "black", seen, entries);
    }
    if (shouldShowResolucao(mode) && questao.resolucao) {
      collectFromText(questao.resolucao, "red", seen, entries);
    }
  }

  return entries;
}

let hiddenContainer: HTMLDivElement | null = null;

// html-to-image's toCanvas() clona o nó e o serializa dentro de um <foreignObject> SVG usando a
// posição/tamanho reais do elemento — colocá-lo longe da tela via left:-9999px faz essa captura
// sair em branco. Em vez disso, o container fica em (0,0) (necessário para a captura funcionar),
// mas dentro de um wrapper de tamanho zero com overflow:hidden, que o esconde visualmente do
// usuário sem afetar a captura (clipping do wrapper não interfere no snapshot do próprio nó).
function getHiddenContainer(): HTMLDivElement {
  if (hiddenContainer) return hiddenContainer;
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.top = "0";
  wrapper.style.left = "0";
  wrapper.style.width = "0";
  wrapper.style.height = "0";
  wrapper.style.overflow = "hidden";
  wrapper.style.zIndex = "-1";

  const container = document.createElement("div");
  // display:inline-block faz a largura do container encolher para o conteúdo (shrink-to-fit) em
  // vez de herdar a largura 0 do wrapper (que um <div> em block normal usaria como largura auto).
  container.style.display = "inline-block";
  container.style.fontSize = `${REF_FONT_PX}px`;
  container.style.lineHeight = "normal";
  container.style.whiteSpace = "nowrap";
  wrapper.appendChild(container);
  document.body.appendChild(wrapper);
  hiddenContainer = container;
  return container;
}

// Processa as entradas sequencialmente (não Promise.all): todas compartilham o mesmo container
// DOM oculto reaproveitado, então rodar em paralelo causaria uma corrida sobre innerHTML.
export async function rasterizeMathEntries(
  entries: MathEntry[],
): Promise<Map<string, RasterizedMath | null>> {
  const result = new Map<string, RasterizedMath | null>();
  if (entries.length === 0) return result;

  await document.fonts.ready;
  const container = getHiddenContainer();

  for (const entry of entries) {
    try {
      container.style.color = COLOR_HEX[entry.color];
      container.innerHTML = katex.renderToString(entry.latex, { throwOnError: false });
      const canvas = await toCanvas(container, {
        pixelRatio: RASTER_PIXEL_RATIO,
        backgroundColor: undefined,
      });
      result.set(entry.key, {
        dataUrl: canvas.toDataURL("image/png"),
        widthPx: canvas.width,
        heightPx: canvas.height,
        refFontPx: REF_FONT_PX,
      });
    } catch {
      result.set(entry.key, null);
    }
  }

  container.parentElement?.remove();
  hiddenContainer = null;
  return result;
}

// Converte o tamanho rasterizado (em px, capturados a REF_FONT_PX) para mm, proporcional ao
// tamanho de fonte do texto ao redor — assim uma fórmula fica do mesmo tamanho relativo que teria
// se o mesmo HTML tivesse sido desenhado inline naquele tamanho de fonte.
export function mathRasterSizeMm(
  raster: RasterizedMath,
  targetFontSizePt: number,
): { widthMm: number; heightMm: number } {
  const mmPerCssPx = (targetFontSizePt * PT_TO_MM) / raster.refFontPx;
  return {
    widthMm: (raster.widthPx / RASTER_PIXEL_RATIO) * mmPerCssPx,
    heightMm: (raster.heightPx / RASTER_PIXEL_RATIO) * mmPerCssPx,
  };
}
