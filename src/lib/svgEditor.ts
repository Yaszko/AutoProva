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

export interface RectShape extends ShapeStyle {
  id: string;
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
}

export interface CircleShape extends ShapeStyle {
  id: string;
  type: "circle";
  cx: number;
  cy: number;
  r: number;
}

export interface EllipseShape extends ShapeStyle {
  id: string;
  type: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface LineShape {
  id: string;
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

export interface PolygonShape extends ShapeStyle {
  id: string;
  type: "polygon";
  points: string;
  closed: boolean;
  tx: number;
  ty: number;
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
  | RawShape;

export type AddableShapeType = Exclude<SvgShape["type"], "raw">;

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

function elementToShape(el: Element): SvgShape {
  const tag = el.tagName.toLowerCase();
  const style: ShapeStyle = {
    fill: strAttr(el, "fill", "#3b82f6"),
    stroke: strAttr(el, "stroke", "none"),
    strokeWidth: numAttr(el, "stroke-width", 1),
    opacity: el.hasAttribute("opacity") ? numAttr(el, "opacity", 1) : 1,
  };

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
        ...style,
      };
    case "circle":
      return {
        id: nextId(),
        type: "circle",
        cx: numAttr(el, "cx"),
        cy: numAttr(el, "cy"),
        r: numAttr(el, "r", 10),
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
      return {
        id: nextId(),
        type: "path",
        d: strAttr(el, "d", ""),
        tx: 0,
        ty: 0,
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
      return `<rect${attr("x", shape.x)}${attr("y", shape.y)}${attr("width", shape.width)}${attr("height", shape.height)}${shape.rx ? attr("rx", shape.rx) : ""}${attr("fill", shape.fill)}${attr("stroke", shape.stroke)}${attr("stroke-width", shape.strokeWidth)}${attr("opacity", shape.opacity)}/>`;
    case "circle":
      return `<circle${attr("cx", shape.cx)}${attr("cy", shape.cy)}${attr("r", shape.r)}${attr("fill", shape.fill)}${attr("stroke", shape.stroke)}${attr("stroke-width", shape.strokeWidth)}${attr("opacity", shape.opacity)}/>`;
    case "ellipse":
      return `<ellipse${attr("cx", shape.cx)}${attr("cy", shape.cy)}${attr("rx", shape.rx)}${attr("ry", shape.ry)}${attr("fill", shape.fill)}${attr("stroke", shape.stroke)}${attr("stroke-width", shape.strokeWidth)}${attr("opacity", shape.opacity)}/>`;
    case "line":
      return `<line${attr("x1", shape.x1)}${attr("y1", shape.y1)}${attr("x2", shape.x2)}${attr("y2", shape.y2)}${attr("stroke", shape.stroke)}${attr("stroke-width", shape.strokeWidth)}${attr("opacity", shape.opacity)}/>`;
    case "polygon":
      return `<${shape.closed ? "polygon" : "polyline"}${attr("points", shape.points)}${translateAttr(shape.tx, shape.ty)}${attr("fill", shape.closed ? shape.fill : "none")}${attr("stroke", shape.stroke)}${attr("stroke-width", shape.strokeWidth)}${attr("opacity", shape.opacity)}/>`;
    case "text":
      return `<text${attr("x", shape.x)}${attr("y", shape.y)}${attr("font-size", shape.fontSize)}${attr("fill", shape.fill)}${attr("opacity", shape.opacity)}>${escapeXmlText(shape.text)}</text>`;
    case "path":
      return `<path${attr("d", shape.d)}${translateAttr(shape.tx, shape.ty)}${attr("fill", shape.fill)}${attr("stroke", shape.stroke)}${attr("stroke-width", shape.strokeWidth)}${attr("opacity", shape.opacity)}/>`;
    case "raw":
      return shape.markup;
  }
}

export function serializeSvgDoc(doc: SvgDoc): string {
  const body = doc.shapes.map(shapeToMarkup).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${doc.width} ${doc.height}" width="${doc.width}" height="${doc.height}">${body}</svg>`;
}

export function createDefaultShape(type: AddableShapeType, doc: SvgDoc): SvgShape {
  const cx = doc.width / 2;
  const cy = doc.height / 2;
  switch (type) {
    case "rect":
      return { id: nextId(), type: "rect", x: cx - 40, y: cy - 30, width: 80, height: 60, rx: 0, fill: "#3b82f6", stroke: "#1d4ed8", strokeWidth: 2, opacity: 1 };
    case "circle":
      return { id: nextId(), type: "circle", cx, cy, r: 40, fill: "#3b82f6", stroke: "#1d4ed8", strokeWidth: 2, opacity: 1 };
    case "ellipse":
      return { id: nextId(), type: "ellipse", cx, cy, rx: 50, ry: 30, fill: "#3b82f6", stroke: "#1d4ed8", strokeWidth: 2, opacity: 1 };
    case "line":
      return { id: nextId(), type: "line", x1: cx - 40, y1: cy, x2: cx + 40, y2: cy, stroke: "#3f3f46", strokeWidth: 2, opacity: 1 };
    case "polygon":
      return { id: nextId(), type: "polygon", points: `${cx},${cy - 40} ${cx + 40},${cy + 30} ${cx - 40},${cy + 30}`, closed: true, tx: 0, ty: 0, fill: "#3b82f6", stroke: "#1d4ed8", strokeWidth: 2, opacity: 1 };
    case "text":
      return { id: nextId(), type: "text", x: cx - 20, y: cy, text: "Texto", fontSize: 16, fill: "#27272a", opacity: 1 };
    case "path":
      return { id: nextId(), type: "path", d: `M ${cx - 40} ${cy} L ${cx} ${cy - 40} L ${cx + 40} ${cy} Z`, tx: 0, ty: 0, fill: "#3b82f6", stroke: "#1d4ed8", strokeWidth: 2, opacity: 1 };
  }
}

export const SHAPE_TYPE_LABELS: Record<SvgShape["type"], string> = {
  rect: "Retângulo",
  circle: "Círculo",
  ellipse: "Elipse",
  line: "Linha",
  polygon: "Polígono",
  text: "Texto",
  path: "Caminho",
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
    case "text":
      return { ...shape, x: shape.x + dx, y: shape.y + dy };
    case "polygon":
    case "path":
      return { ...shape, tx: shape.tx + dx, ty: shape.ty + dy };
    case "raw":
      return shape;
  }
}
