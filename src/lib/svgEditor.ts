// Modelo estrutural usado pelo editor visual de imagens (ImageEditorModal): um SVG é
// desmontado em uma lista de formas editáveis (shapes) e remontado de volta em uma string SVG
// crua, que é o mesmo formato já aceito em `Questao.imagem` (ver normalizeImageSource em
// QuestionEditor.tsx). Elementos não suportados (ex: <g>, <defs>, gradientes) viram um shape
// "raw" que preserva o markup original — assim o editor nunca perde conteúdo ao salvar de volta,
// mesmo que não saiba editá-lo visualmente.

export const CANVAS_DEFAULT_WIDTH = 400;
export const CANVAS_DEFAULT_HEIGHT = 300;

interface ShapeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

/** Sólido ('') / tracejado / pontilhado — mapeia direto para o atributo SVG stroke-dasharray. */
export type StrokeDasharray = "" | "6 4" | "1.5 3";

interface StrokedStyle {
  stroke: string;
  strokeWidth: number;
  strokeDasharray: StrokeDasharray;
  opacity: number;
}

export interface RectShape extends ShapeStyle {
  id: string;
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  strokeDasharray: StrokeDasharray;
}

export interface CircleShape extends ShapeStyle {
  id: string;
  type: "circle";
  cx: number;
  cy: number;
  r: number;
  strokeDasharray: StrokeDasharray;
}

export interface EllipseShape extends ShapeStyle {
  id: string;
  type: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  strokeDasharray: StrokeDasharray;
}

export interface LineShape extends StrokedStyle {
  id: string;
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PolygonShape extends ShapeStyle {
  id: string;
  type: "polygon";
  points: string;
  closed: boolean;
  tx: number;
  ty: number;
  strokeDasharray: StrokeDasharray;
}

export interface TextShape {
  id: string;
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fill: string;
  opacity: number;
}

export interface PathShape extends ShapeStyle {
  id: string;
  type: "path";
  d: string;
  tx: number;
  ty: number;
  strokeDasharray: StrokeDasharray;
}

/** Curva quadrática (x1,y1)→(x2,y2) com ponto de controle (cx,cy) arrastável no canvas. Serializada
 * como <path> com atributos data-* para poder ser reconstruída (round-trip) por parseSvgDoc — um
 * <path> sem essa marcação cai no tipo "path" genérico normal, sem regressão para SVGs externos. */
export interface CurveShape extends StrokedStyle {
  id: string;
  type: "curve";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cx: number;
  cy: number;
}

export interface RawShape {
  id: string;
  type: "raw";
  tag: string;
  markup: string;
}

export type SvgShape =
  | RectShape
  | CircleShape
  | EllipseShape
  | LineShape
  | PolygonShape
  | TextShape
  | PathShape
  | CurveShape
  | RawShape;

export type AddableShapeType = Exclude<SvgShape["type"], "raw">;
/** Formas que podem ser desenhadas por clique-arrasto direto no canvas (todas exceto texto, que é
 * clique único para posicionar). */
export type DraggableShapeType = Exclude<AddableShapeType, "text">;

export interface SvgDoc {
  width: number;
  height: number;
  shapes: SvgShape[];
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `shape-${idCounter}`;
}

export function createBlankDoc(): SvgDoc {
  return { width: CANVAS_DEFAULT_WIDTH, height: CANVAS_DEFAULT_HEIGHT, shapes: [] };
}

function numAttr(el: Element, attr: string, fallback = 0): number {
  const value = Number(el.getAttribute(attr));
  return Number.isFinite(value) ? value : fallback;
}

function strAttr(el: Element, attr: string, fallback: string): string {
  return el.getAttribute(attr) ?? fallback;
}

function extractDimensions(svgEl: Element): [number, number] {
  const viewBox = svgEl.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n)) && parts[2] > 0 && parts[3] > 0) {
      return [parts[2], parts[3]];
    }
  }
  const w = Number(svgEl.getAttribute("width"));
  const h = Number(svgEl.getAttribute("height"));
  return [
    Number.isFinite(w) && w > 0 ? w : CANVAS_DEFAULT_WIDTH,
    Number.isFinite(h) && h > 0 ? h : CANVAS_DEFAULT_HEIGHT,
  ];
}

const DASH_PRESETS: StrokeDasharray[] = ["6 4", "1.5 3"];

// Só reconhece exatamente os presets que o próprio editor gera — formas com stroke-dasharray de
// SVGs externos que não batem com nenhum preset caem em sólido (''), o mesmo tipo de perda
// aceitável que já existe para outros atributos não totalmente editáveis aqui (ver comentário no
// topo do arquivo sobre o fallback "raw").
function dashAttr(el: Element): StrokeDasharray {
  const raw = el.getAttribute("stroke-dasharray")?.trim();
  return DASH_PRESETS.find((preset) => preset === raw) ?? "";
}

function elementToShape(el: Element): SvgShape {
  const tag = el.tagName.toLowerCase();
  const style: ShapeStyle = {
    fill: strAttr(el, "fill", "#3b82f6"),
    stroke: strAttr(el, "stroke", "none"),
    strokeWidth: numAttr(el, "stroke-width", 1),
    opacity: el.hasAttribute("opacity") ? numAttr(el, "opacity", 1) : 1,
  };
  const strokeDasharray = dashAttr(el);

  switch (tag) {
    case "rect":
      return {
        id: nextId(),
        type: "rect",
        x: numAttr(el, "x"),
        y: numAttr(el, "y"),
        width: numAttr(el, "width", 10),
        height: numAttr(el, "height", 10),
        rx: numAttr(el, "rx", 0),
        strokeDasharray,
        ...style,
      };
    case "circle":
      return {
        id: nextId(),
        type: "circle",
        cx: numAttr(el, "cx"),
        cy: numAttr(el, "cy"),
        r: numAttr(el, "r", 10),
        strokeDasharray,
        ...style,
      };
    case "ellipse":
      return {
        id: nextId(),
        type: "ellipse",
        cx: numAttr(el, "cx"),
        cy: numAttr(el, "cy"),
        rx: numAttr(el, "rx", 10),
        ry: numAttr(el, "ry", 10),
        strokeDasharray,
        ...style,
      };
    case "line":
      return {
        id: nextId(),
        type: "line",
        x1: numAttr(el, "x1"),
        y1: numAttr(el, "y1"),
        x2: numAttr(el, "x2", 10),
        y2: numAttr(el, "y2"),
        stroke: strAttr(el, "stroke", "#3b82f6"),
        strokeWidth: numAttr(el, "stroke-width", 2),
        strokeDasharray,
        opacity: style.opacity,
      };
    case "polygon":
    case "polyline":
      return {
        id: nextId(),
        type: "polygon",
        points: strAttr(el, "points", ""),
        closed: tag === "polygon",
        tx: 0,
        ty: 0,
        strokeDasharray,
        ...style,
      };
    case "text":
      return {
        id: nextId(),
        type: "text",
        x: numAttr(el, "x"),
        y: numAttr(el, "y"),
        text: el.textContent ?? "",
        fontSize: numAttr(el, "font-size", 16),
        fill: strAttr(el, "fill", "#e4e4e7"),
        opacity: style.opacity,
      };
    case "path":
      if (el.getAttribute("data-shape") === "curve") {
        return {
          id: nextId(),
          type: "curve",
          x1: numAttr(el, "data-x1"),
          y1: numAttr(el, "data-y1"),
          x2: numAttr(el, "data-x2", 10),
          y2: numAttr(el, "data-y2"),
          cx: numAttr(el, "data-cx"),
          cy: numAttr(el, "data-cy"),
          stroke: strAttr(el, "stroke", "#3b82f6"),
          strokeWidth: numAttr(el, "stroke-width", 2),
          strokeDasharray,
          opacity: style.opacity,
        };
      }
      return {
        id: nextId(),
        type: "path",
        d: strAttr(el, "d", ""),
        tx: 0,
        ty: 0,
        strokeDasharray,
        ...style,
      };
    default:
      return { id: nextId(), type: "raw", tag, markup: el.outerHTML };
  }
}

export function parseSvgDoc(source: string): SvgDoc {
  const trimmed = source.trim();
  if (!trimmed.startsWith("<svg")) return createBlankDoc();
  try {
    const parsed = new DOMParser().parseFromString(trimmed, "image/svg+xml");
    const svgEl = parsed.querySelector("svg");
    if (!svgEl || parsed.querySelector("parsererror")) return createBlankDoc();
    const [width, height] = extractDimensions(svgEl);
    const shapes = Array.from(svgEl.children).map(elementToShape);
    return { width, height, shapes };
  } catch {
    return createBlankDoc();
  }
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function attr(name: string, value: string | number): string {
  return ` ${name}="${String(value).replace(/"/g, "&quot;")}"`;
}

function translateAttr(tx: number, ty: number): string {
  return tx !== 0 || ty !== 0 ? attr("transform", `translate(${tx} ${ty})`) : "";
}

function shapeToMarkup(shape: SvgShape): string {
  switch (shape.type) {
    case "rect":
      return `<rect${attr("x", shape.x)}${attr("y", shape.y)}${attr("width", shape.width)}${attr("height", shape.height)}${shape.rx ? attr("rx", shape.rx) : ""}${attr("fill", shape.fill)}${attr("stroke", shape.stroke)}${attr("stroke-width", shape.strokeWidth)}${shape.strokeDasharray ? attr("stroke-dasharray", shape.strokeDasharray) : ""}${attr("opacity", shape.opacity)}/>`;
    case "circle":
      return `<circle${attr("cx", shape.cx)}${attr("cy", shape.cy)}${attr("r", shape.r)}${attr("fill", shape.fill)}${attr("stroke", shape.stroke)}${attr("stroke-width", shape.strokeWidth)}${shape.strokeDasharray ? attr("stroke-dasharray", shape.strokeDasharray) : ""}${attr("opacity", shape.opacity)}/>`;
    case "ellipse":
      return `<ellipse${attr("cx", shape.cx)}${attr("cy", shape.cy)}${attr("rx", shape.rx)}${attr("ry", shape.ry)}${attr("fill", shape.fill)}${attr("stroke", shape.stroke)}${attr("stroke-width", shape.strokeWidth)}${shape.strokeDasharray ? attr("stroke-dasharray", shape.strokeDasharray) : ""}${attr("opacity", shape.opacity)}/>`;
    case "line":
      return `<line${attr("x1", shape.x1)}${attr("y1", shape.y1)}${attr("x2", shape.x2)}${attr("y2", shape.y2)}${attr("stroke", shape.stroke)}${attr("stroke-width", shape.strokeWidth)}${shape.strokeDasharray ? attr("stroke-dasharray", shape.strokeDasharray) : ""}${attr("opacity", shape.opacity)}/>`;
    case "polygon":
      return `<${shape.closed ? "polygon" : "polyline"}${attr("points", shape.points)}${translateAttr(shape.tx, shape.ty)}${attr("fill", shape.closed ? shape.fill : "none")}${attr("stroke", shape.stroke)}${attr("stroke-width", shape.strokeWidth)}${shape.strokeDasharray ? attr("stroke-dasharray", shape.strokeDasharray) : ""}${attr("opacity", shape.opacity)}/>`;
    case "text":
      return `<text${attr("x", shape.x)}${attr("y", shape.y)}${attr("font-size", shape.fontSize)}${attr("fill", shape.fill)}${attr("opacity", shape.opacity)}>${escapeXmlText(shape.text)}</text>`;
    case "path":
      return `<path${attr("d", shape.d)}${translateAttr(shape.tx, shape.ty)}${attr("fill", shape.fill)}${attr("stroke", shape.stroke)}${attr("stroke-width", shape.strokeWidth)}${shape.strokeDasharray ? attr("stroke-dasharray", shape.strokeDasharray) : ""}${attr("opacity", shape.opacity)}/>`;
    case "curve":
      return `<path${attr("d", `M ${shape.x1} ${shape.y1} Q ${shape.cx} ${shape.cy} ${shape.x2} ${shape.y2}`)}${attr("data-shape", "curve")}${attr("data-x1", shape.x1)}${attr("data-y1", shape.y1)}${attr("data-x2", shape.x2)}${attr("data-y2", shape.y2)}${attr("data-cx", shape.cx)}${attr("data-cy", shape.cy)}${attr("fill", "none")}${attr("stroke", shape.stroke)}${attr("stroke-width", shape.strokeWidth)}${shape.strokeDasharray ? attr("stroke-dasharray", shape.strokeDasharray) : ""}${attr("opacity", shape.opacity)}/>`;
    case "raw":
      return shape.markup;
  }
}

export function serializeSvgDoc(doc: SvgDoc): string {
  const body = doc.shapes.map(shapeToMarkup).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${doc.width} ${doc.height}" width="${doc.width}" height="${doc.height}">${body}</svg>`;
}

/** Cor/traço "correntes" da ferramenta ativa — usados tanto para o preview ao vivo durante o
 * arrasto quanto para a forma final, e lembrados entre desenhos (ver ImageEditorModal) para não
 * resetar a cada novo traço, como qualquer app de desenho faz. */
export interface DrawStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray: StrokeDasharray;
  opacity: number;
}

export const DEFAULT_SHAPE_STYLE: DrawStyle = { fill: "#3b82f6", stroke: "#1d4ed8", strokeWidth: 2, strokeDasharray: "", opacity: 1 };
export const DEFAULT_BRUSH_STYLE: DrawStyle = { fill: "none", stroke: "#27272a", strokeWidth: 3, strokeDasharray: "", opacity: 1 };

const MIN_DRAG_EXTENT = 12;

// Garante uma extensão mínima visível/selecionável mesmo se o usuário só clicar sem arrastar,
// preservando o ponto de ancoragem (start) e a direção do arrasto.
function ensureMinExtent(delta: number): number {
  if (Math.abs(delta) >= MIN_DRAG_EXTENT) return delta;
  return delta < 0 ? -MIN_DRAG_EXTENT : MIN_DRAG_EXTENT;
}

export interface Point {
  x: number;
  y: number;
}

// Constrói a forma final a partir do retângulo de arrasto (start→end) para toda ferramenta
// "clique-arrasta" exceto texto (posicionado por clique único, ver createTextShapeAt) e pincel
// (traço livre, ver buildSmoothPathD + createFreehandShape).
export function createShapeFromDrag(type: DraggableShapeType, start: Point, end: Point, style: DrawStyle): SvgShape {
  const id = nextId();
  const dx = ensureMinExtent(end.x - start.x);
  const dy = ensureMinExtent(end.y - start.y);
  const minX = Math.min(start.x, start.x + dx);
  const minY = Math.min(start.y, start.y + dy);
  const width = Math.abs(dx);
  const height = Math.abs(dy);
  const cx = minX + width / 2;
  const cy = minY + height / 2;

  switch (type) {
    case "rect":
      return { id, type: "rect", x: minX, y: minY, width, height, rx: 0, ...style };
    case "circle":
      return { id, type: "circle", cx, cy, r: Math.max(width, height) / 2, ...style };
    case "ellipse":
      return { id, type: "ellipse", cx, cy, rx: width / 2, ry: height / 2, ...style };
    case "line":
      return { id, type: "line", x1: start.x, y1: start.y, x2: start.x + dx, y2: start.y + dy, stroke: style.stroke, strokeWidth: style.strokeWidth, strokeDasharray: style.strokeDasharray, opacity: style.opacity };
    case "curve": {
      const x2 = start.x + dx;
      const y2 = start.y + dy;
      // Ponto de controle começa no meio do segmento (curva "reta" até o usuário arrastar o handle).
      return {
        id,
        type: "curve",
        x1: start.x,
        y1: start.y,
        x2,
        y2,
        cx: (start.x + x2) / 2,
        cy: (start.y + y2) / 2,
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
        strokeDasharray: style.strokeDasharray,
        opacity: style.opacity,
      };
    }
    case "polygon": {
      const points = `${cx},${minY} ${minX + width},${minY + height} ${minX},${minY + height}`;
      return { id, type: "polygon", points, closed: true, tx: 0, ty: 0, ...style };
    }
    case "path":
      // Ferramenta "path" bruto não tem UI própria de desenho (só chega via IA/import) — clique
      // simples também não deveria ativar essa ferramenta, mas mantido por completude do tipo.
      return { id, type: "path", d: `M ${minX} ${minY} L ${minX + width} ${minY} L ${cx} ${minY + height} Z`, tx: 0, ty: 0, ...style };
  }
}

export function createTextShapeAt(point: Point): TextShape {
  return { id: nextId(), type: "text", x: point.x, y: point.y, text: "Texto", fontSize: 16, fill: "#27272a", opacity: 1 };
}

// Suaviza uma lista de pontos capturados no pointermove do pincel em um "d" de <path>, usando
// curvas quadráticas passando pelos pontos médios consecutivos — técnica padrão de suavização de
// traço livre (evita um path angular/serrilhado feito só de segmentos retos).
export function buildSmoothPathD(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length < 3) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export function createFreehandShape(points: Point[], style: DrawStyle): PathShape {
  return {
    id: nextId(),
    type: "path",
    d: buildSmoothPathD(points),
    tx: 0,
    ty: 0,
    fill: "none",
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    strokeDasharray: style.strokeDasharray,
    opacity: style.opacity,
  };
}

export const SHAPE_TYPE_LABELS: Record<SvgShape["type"], string> = {
  rect: "Retângulo",
  circle: "Círculo",
  ellipse: "Elipse",
  line: "Linha",
  polygon: "Polígono",
  text: "Texto",
  path: "Caminho",
  curve: "Curva",
  raw: "Elemento",
};

export function moveShapeBy(shape: SvgShape, dx: number, dy: number): SvgShape {
  switch (shape.type) {
    case "rect":
      return { ...shape, x: shape.x + dx, y: shape.y + dy };
    case "circle":
    case "ellipse":
      return { ...shape, cx: shape.cx + dx, cy: shape.cy + dy };
    case "line":
      return { ...shape, x1: shape.x1 + dx, y1: shape.y1 + dy, x2: shape.x2 + dx, y2: shape.y2 + dy };
    case "curve":
      return {
        ...shape,
        x1: shape.x1 + dx,
        y1: shape.y1 + dy,
        x2: shape.x2 + dx,
        y2: shape.y2 + dy,
        cx: shape.cx + dx,
        cy: shape.cy + dy,
      };
    case "text":
      return { ...shape, x: shape.x + dx, y: shape.y + dy };
    case "polygon":
    case "path":
      return { ...shape, tx: shape.tx + dx, ty: shape.ty + dy };
    case "raw":
      return shape;
  }
}

/** Move só o ponto de controle de uma curva (arrasto do handle, separado do arrasto que move a
 * curva inteira). */
export function moveCurveControlTo(shape: CurveShape, point: Point): CurveShape {
  return { ...shape, cx: point.x, cy: point.y };
}
