import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Circle, MousePointer2, Minus, Paintbrush, Spline, Square, Trash2, Triangle, Type, X } from "lucide-react";
import {
  DEFAULT_BRUSH_STYLE,
  DEFAULT_SHAPE_STYLE,
  DraggableShapeType,
  DrawStyle,
  Point,
  SHAPE_TYPE_LABELS,
  StrokeDasharray,
  SvgDoc,
  SvgShape,
  createFreehandShape,
  createShapeFromDrag,
  createTextShapeAt,
  moveCurveControlTo,
  moveShapeBy,
  parseSvgDoc,
  serializeSvgDoc,
} from "../lib/svgEditor";

interface ImageEditorModalProps {
  questionNumero: number;
  initialImage: string | undefined;
  onSave: (svg: string) => void;
  onClose: () => void;
}

type ShapeDrawTool = Exclude<DraggableShapeType, "path">;
type DrawTool = ShapeDrawTool | "text" | "freehand";

const SHAPE_TOOLS: { type: ShapeDrawTool; label: string; icon: typeof Square }[] = [
  { type: "rect", label: "Retângulo", icon: Square },
  { type: "circle", label: "Círculo", icon: Circle },
  { type: "polygon", label: "Triângulo", icon: Triangle },
  { type: "line", label: "Linha", icon: Minus },
  { type: "curve", label: "Curva", icon: Spline },
];

const MIN_FREEHAND_POINT_DISTANCE = 3;

function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-zinc-500">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none"
      />
    </label>
  );
}

function isHexColor(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-zinc-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={isHexColor(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-8 shrink-0 cursor-pointer rounded border border-zinc-800 bg-zinc-950 p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="none"
          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
        />
      </div>
    </label>
  );
}

function StrokeStyleField({
  value,
  onChange,
}: {
  value: StrokeDasharray;
  onChange: (value: StrokeDasharray) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-zinc-500">Estilo do traço</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as StrokeDasharray)}
        className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none"
      >
        <option value="">Sólido</option>
        <option value="6 4">Tracejado</option>
        <option value="1.5 3">Pontilhado</option>
      </select>
    </label>
  );
}

interface ShapeElementProps {
  shape: SvgShape;
  interactive: boolean;
  onPointerDown: (e: React.PointerEvent, shape: SvgShape) => void;
  registerRef: (id: string, el: SVGGraphicsElement | null) => void;
}

function ShapeElement({ shape, interactive, onPointerDown, registerRef }: ShapeElementProps) {
  const cursor = shape.type === "raw" ? undefined : "grab";
  const commonProps = interactive
    ? { onPointerDown: (e: React.PointerEvent) => onPointerDown(e, shape), style: { cursor, outline: "none" as const } }
    : { style: { outline: "none" as const, pointerEvents: "none" as const } };

  switch (shape.type) {
    case "rect":
      return (
        <rect
          ref={(el) => registerRef(shape.id, el)}
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          rx={shape.rx}
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          strokeDasharray={shape.strokeDasharray || undefined}
          opacity={shape.opacity}
          {...commonProps}
        />
      );
    case "circle":
      return (
        <circle
          ref={(el) => registerRef(shape.id, el)}
          cx={shape.cx}
          cy={shape.cy}
          r={shape.r}
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          strokeDasharray={shape.strokeDasharray || undefined}
          opacity={shape.opacity}
          {...commonProps}
        />
      );
    case "ellipse":
      return (
        <ellipse
          ref={(el) => registerRef(shape.id, el)}
          cx={shape.cx}
          cy={shape.cy}
          rx={shape.rx}
          ry={shape.ry}
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          strokeDasharray={shape.strokeDasharray || undefined}
          opacity={shape.opacity}
          {...commonProps}
        />
      );
    case "line":
      return (
        <line
          ref={(el) => registerRef(shape.id, el)}
          x1={shape.x1}
          y1={shape.y1}
          x2={shape.x2}
          y2={shape.y2}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          strokeDasharray={shape.strokeDasharray || undefined}
          opacity={shape.opacity}
          {...commonProps}
        />
      );
    case "curve":
      return (
        <path
          ref={(el) => registerRef(shape.id, el)}
          d={`M ${shape.x1} ${shape.y1} Q ${shape.cx} ${shape.cy} ${shape.x2} ${shape.y2}`}
          fill="none"
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          strokeDasharray={shape.strokeDasharray || undefined}
          opacity={shape.opacity}
          {...commonProps}
        />
      );
    case "polygon":
      return shape.closed ? (
        <polygon
          ref={(el) => registerRef(shape.id, el)}
          points={shape.points}
          transform={`translate(${shape.tx} ${shape.ty})`}
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          strokeDasharray={shape.strokeDasharray || undefined}
          opacity={shape.opacity}
          {...commonProps}
        />
      ) : (
        <polyline
          ref={(el) => registerRef(shape.id, el)}
          points={shape.points}
          transform={`translate(${shape.tx} ${shape.ty})`}
          fill="none"
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          strokeDasharray={shape.strokeDasharray || undefined}
          opacity={shape.opacity}
          {...commonProps}
        />
      );
    case "text":
      return (
        <text
          ref={(el) => registerRef(shape.id, el)}
          x={shape.x}
          y={shape.y}
          fontSize={shape.fontSize}
          fill={shape.fill}
          opacity={shape.opacity}
          {...commonProps}
        >
          {shape.text}
        </text>
      );
    case "path":
      return (
        <path
          ref={(el) => registerRef(shape.id, el)}
          d={shape.d}
          transform={`translate(${shape.tx} ${shape.ty})`}
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          strokeDasharray={shape.strokeDasharray || undefined}
          opacity={shape.opacity}
          {...commonProps}
        />
      );
    case "raw":
      return (
        <g
          ref={(el) => registerRef(shape.id, el)}
          {...commonProps}
          dangerouslySetInnerHTML={{ __html: shape.markup }}
        />
      );
  }
}

interface DragState {
  id: string;
  startPoint: Point;
  startShape: SvgShape;
}

function toSvgPoint(svg: SVGSVGElement | null, clientX: number, clientY: number): Point {
  if (!svg) return { x: 0, y: 0 };
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const transformed = point.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}

export function ImageEditorModal({
  questionNumero,
  initialImage,
  onSave,
  onClose,
}: ImageEditorModalProps) {
  const [doc, setDoc] = useState<SvgDoc>(() => parseSvgDoc(initialImage ?? ""));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Ferramenta de desenho armada (null = modo seleção/mover). Cada forma é desenhada por
  // clique-arrasto direto no canvas (exceto texto, clique único) e o editor volta ao modo seleção
  // sozinho depois de cada forma criada — evita desenhar de novo sem querer.
  const [activeTool, setActiveTool] = useState<DrawTool | null>(null);
  const [drawStart, setDrawStart] = useState<Point | null>(null);
  const [drawEnd, setDrawEnd] = useState<Point | null>(null);
  const [freehandPoints, setFreehandPoints] = useState<Point[] | null>(null);
  const [lastBrushStyle, setLastBrushStyle] = useState<DrawStyle>(DEFAULT_BRUSH_STYLE);
  const [draggingCurveControl, setDraggingCurveControl] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const shapeElRefs = useRef<Map<string, SVGGraphicsElement>>(new Map());

  const selectedShape = doc.shapes.find((s) => s.id === selectedId) ?? null;
  const replacedExisting = Boolean(initialImage?.trim());

  function registerShapeRef(id: string, el: SVGGraphicsElement | null) {
    if (el) shapeElRefs.current.set(id, el);
    else shapeElRefs.current.delete(id);
  }

  useLayoutEffect(() => {
    if (!selectedId) {
      setSelectionBox(null);
      return;
    }
    const el = shapeElRefs.current.get(selectedId);
    if (!el) {
      setSelectionBox(null);
      return;
    }
    try {
      const box = el.getBBox();
      setSelectionBox({ x: box.x, y: box.y, width: box.width, height: box.height });
    } catch {
      setSelectionBox(null);
    }
  }, [selectedId, doc]);

  // Cancela qualquer desenho/arrasto em andamento e volta ao modo seleção.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setActiveTool(null);
      setDrawStart(null);
      setDrawEnd(null);
      setFreehandPoints(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Arrasto de mover uma forma existente (modo seleção).
  useEffect(() => {
    if (!draggingId) return;

    function handleMove(e: PointerEvent) {
      const drag = dragStateRef.current;
      if (!drag) return;
      const current = toSvgPoint(svgRef.current, e.clientX, e.clientY);
      const dx = current.x - drag.startPoint.x;
      const dy = current.y - drag.startPoint.y;
      setDoc((prev) => ({
        ...prev,
        shapes: prev.shapes.map((s) => (s.id === drag.id ? moveShapeBy(drag.startShape, dx, dy) : s)),
      }));
    }

    function handleUp() {
      dragStateRef.current = null;
      setDraggingId(null);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [draggingId]);

  // Arrasto do handle de controle de uma curva selecionada.
  useEffect(() => {
    if (!draggingCurveControl) return;

    function handleMove(e: PointerEvent) {
      const point = toSvgPoint(svgRef.current, e.clientX, e.clientY);
      setDoc((prev) => ({
        ...prev,
        shapes: prev.shapes.map((s) => (s.id === selectedId && s.type === "curve" ? moveCurveControlTo(s, point) : s)),
      }));
    }

    function handleUp() {
      setDraggingCurveControl(false);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [draggingCurveControl, selectedId]);

  // Desenho de forma por clique-arrasto (retângulo/círculo/elipse/linha/curva/triângulo).
  useEffect(() => {
    if (!drawStart) return;

    function handleMove(e: PointerEvent) {
      setDrawEnd(toSvgPoint(svgRef.current, e.clientX, e.clientY));
    }

    function handleUp(e: PointerEvent) {
      const end = toSvgPoint(svgRef.current, e.clientX, e.clientY);
      if (activeTool && activeTool !== "text" && activeTool !== "freehand" && drawStart) {
        const shape = createShapeFromDrag(activeTool, drawStart, end, DEFAULT_SHAPE_STYLE);
        setDoc((prev) => ({ ...prev, shapes: [...prev.shapes, shape] }));
        setSelectedId(shape.id);
      }
      setActiveTool(null);
      setDrawStart(null);
      setDrawEnd(null);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- drawStart/activeTool lidos via closure fresca a cada novo efeito (recriado sempre que drawStart muda)
  }, [drawStart]);

  // Traço livre do pincel: acumula pontos amostrados no arrasto e suaviza em um path ao soltar.
  useEffect(() => {
    if (!freehandPoints) return;

    function handleMove(e: PointerEvent) {
      const point = toSvgPoint(svgRef.current, e.clientX, e.clientY);
      setFreehandPoints((prev) => {
        if (!prev || prev.length === 0) return [point];
        const last = prev[prev.length - 1];
        const dist = Math.hypot(point.x - last.x, point.y - last.y);
        if (dist < MIN_FREEHAND_POINT_DISTANCE) return prev;
        return [...prev, point];
      });
    }

    function handleUp() {
      setFreehandPoints((prev) => {
        if (prev && prev.length > 1) {
          const shape = createFreehandShape(prev, lastBrushStyle);
          setDoc((d) => ({ ...d, shapes: [...d.shapes, shape] }));
          setSelectedId(shape.id);
        }
        return null;
      });
      setActiveTool(null);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só precisa reagir a iniciar/parar o traço (freehandPoints truthy/null), não a cada ponto adicionado
  }, [freehandPoints !== null]);

  function handleCanvasPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    const point = toSvgPoint(svgRef.current, e.clientX, e.clientY);

    if (activeTool === "text") {
      const shape = createTextShapeAt(point);
      setDoc((prev) => ({ ...prev, shapes: [...prev.shapes, shape] }));
      setSelectedId(shape.id);
      setActiveTool(null);
      return;
    }

    if (activeTool === "freehand") {
      setFreehandPoints([point]);
      return;
    }

    if (activeTool) {
      setDrawStart(point);
      setDrawEnd(point);
      return;
    }

    setSelectedId(null);
  }

  function handleShapePointerDown(e: React.PointerEvent, shape: SvgShape) {
    e.stopPropagation();
    setSelectedId(shape.id);
    if (shape.type === "raw") return;
    const point = toSvgPoint(svgRef.current, e.clientX, e.clientY);
    dragStateRef.current = { id: shape.id, startPoint: point, startShape: shape };
    setDraggingId(shape.id);
  }

  function handleCurveControlPointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    setDraggingCurveControl(true);
  }

  function updateShape(id: string, patch: Record<string, unknown>) {
    setDoc((prev) => ({
      ...prev,
      shapes: prev.shapes.map((s) => (s.id === id ? ({ ...s, ...patch } as SvgShape) : s)),
    }));
    // Se o usuário ajustar cor/espessura de um traço de pincel (shape "path"), o próximo traço
    // desenhado já começa com esse estilo — como qualquer app de desenho lembra o último pincel.
    const shape = doc.shapes.find((s) => s.id === id);
    if (shape?.type === "path") {
      setLastBrushStyle((prev) => ({
        fill: "none",
        stroke: (patch.stroke as string) ?? shape.stroke,
        strokeWidth: (patch.strokeWidth as number) ?? shape.strokeWidth,
        strokeDasharray: (patch.strokeDasharray as StrokeDasharray) ?? shape.strokeDasharray,
        opacity: (patch.opacity as number) ?? prev.opacity ?? shape.opacity,
      }));
    }
  }

  function handleRemoveShape(id: string) {
    setDoc((prev) => ({ ...prev, shapes: prev.shapes.filter((s) => s.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  }

  function handleSave() {
    onSave(serializeSvgDoc(doc));
  }

  function toggleTool(tool: DrawTool) {
    setSelectedId(null);
    setActiveTool((current) => (current === tool ? null : tool));
  }

  const previewShape: SvgShape | null =
    activeTool && activeTool !== "text" && activeTool !== "freehand" && drawStart && drawEnd
      ? createShapeFromDrag(activeTool, drawStart, drawEnd, DEFAULT_SHAPE_STYLE)
      : null;
  const freehandPreview: SvgShape | null = freehandPoints && freehandPoints.length > 1 ? createFreehandShape(freehandPoints, lastBrushStyle) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl">
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-300">
            Editor de Imagem — Questão {questionNumero}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-zinc-500 hover:text-zinc-300"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              setActiveTool(null);
            }}
            title="Selecionar/mover"
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${
              activeTool === null ? "border-violet-600 bg-violet-950/40 text-violet-300" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            <MousePointer2 size={14} />
            Selecionar
          </button>
          {SHAPE_TOOLS.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleTool(type)}
              title={`Desenhar ${label.toLowerCase()} (clique-arraste no canvas)`}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${
                activeTool === type ? "border-violet-600 bg-violet-950/40 text-violet-300" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => toggleTool("freehand")}
            title="Pincel — clique-arraste para desenhar um traço livre"
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${
              activeTool === "freehand" ? "border-violet-600 bg-violet-950/40 text-violet-300" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            <Paintbrush size={14} />
            Pincel
          </button>
          <button
            type="button"
            onClick={() => toggleTool("text")}
            title="Texto — clique no canvas para posicionar"
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${
              activeTool === "text" ? "border-violet-600 bg-violet-950/40 text-violet-300" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            <Type size={14} />
            Texto
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[1fr_260px]">
          <div className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-50 p-2">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${doc.width} ${doc.height}`}
              className="max-h-full max-w-full"
              style={{ width: "100%", height: "auto", cursor: activeTool ? "crosshair" : undefined, touchAction: "none" }}
              onPointerDown={handleCanvasPointerDown}
            >
              {doc.shapes.map((shape) => (
                <ShapeElement
                  key={shape.id}
                  shape={shape}
                  interactive={activeTool === null}
                  onPointerDown={handleShapePointerDown}
                  registerRef={registerShapeRef}
                />
              ))}
              {previewShape && (
                <g opacity={0.65} pointerEvents="none">
                  <ShapeElement shape={previewShape} interactive={false} onPointerDown={() => {}} registerRef={() => {}} />
                </g>
              )}
              {freehandPreview && (
                <g opacity={0.65} pointerEvents="none">
                  <ShapeElement shape={freehandPreview} interactive={false} onPointerDown={() => {}} registerRef={() => {}} />
                </g>
              )}
              {selectionBox && activeTool === null && (
                <rect
                  x={selectionBox.x - 3}
                  y={selectionBox.y - 3}
                  width={selectionBox.width + 6}
                  height={selectionBox.height + 6}
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  pointerEvents="none"
                />
              )}
              {selectedShape?.type === "curve" && activeTool === null && (
                <g style={{ cursor: "grab" }} onPointerDown={handleCurveControlPointerDown}>
                  {/* Área de clique maior e invisível ao redor do ponto visível — um alvo de raio
                      5 é preciso demais para acertar de primeira com mouse/touch. */}
                  <circle cx={selectedShape.cx} cy={selectedShape.cy} r={14} fill="transparent" />
                  <circle
                    cx={selectedShape.cx}
                    cy={selectedShape.cy}
                    r={5}
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    pointerEvents="none"
                  />
                </g>
              )}
            </svg>
          </div>

          <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
            {activeTool && (
              <p className="rounded-md border border-violet-800 bg-violet-950/30 px-2 py-1.5 text-[11px] text-violet-300">
                {activeTool === "text"
                  ? "Clique no canvas para posicionar o texto."
                  : activeTool === "freehand"
                    ? "Clique e arraste no canvas para desenhar. Esc para cancelar."
                    : "Clique e arraste no canvas para desenhar. Esc para cancelar."}
              </p>
            )}

            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Tela</p>
              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  label="Largura"
                  value={doc.width}
                  onChange={(width) => setDoc((prev) => ({ ...prev, width: Math.max(1, width) }))}
                />
                <NumberField
                  label="Altura"
                  value={doc.height}
                  onChange={(height) => setDoc((prev) => ({ ...prev, height: Math.max(1, height) }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Elementos</p>
              {doc.shapes.length === 0 ? (
                <p className="text-xs text-zinc-600">
                  Nenhum elemento ainda. Use as ferramentas acima para desenhar.
                </p>
              ) : (
                <ul className="space-y-1">
                  {doc.shapes.map((shape, index) => (
                    <li key={shape.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTool(null);
                          setSelectedId(shape.id);
                        }}
                        className={`flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1 text-left text-xs ${
                          shape.id === selectedId
                            ? "border-violet-700 bg-zinc-800 text-violet-300"
                            : "border-zinc-800 text-zinc-400 hover:bg-zinc-800/60"
                        }`}
                      >
                        <span className="truncate">
                          {index + 1}. {SHAPE_TYPE_LABELS[shape.type]}
                        </span>
                        <Trash2
                          size={12}
                          className="shrink-0 text-zinc-500 hover:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveShape(shape.id);
                          }}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selectedShape && (
              <div className="space-y-2 border-t border-zinc-800 pt-3">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                  Propriedades — {SHAPE_TYPE_LABELS[selectedShape.type]}
                </p>

                {selectedShape.type === "rect" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField label="X" value={selectedShape.x} onChange={(x) => updateShape(selectedShape.id, { x })} />
                      <NumberField label="Y" value={selectedShape.y} onChange={(y) => updateShape(selectedShape.id, { y })} />
                      <NumberField label="Largura" value={selectedShape.width} onChange={(width) => updateShape(selectedShape.id, { width })} />
                      <NumberField label="Altura" value={selectedShape.height} onChange={(height) => updateShape(selectedShape.id, { height })} />
                      <NumberField label="Cantos (rx)" value={selectedShape.rx} onChange={(rx) => updateShape(selectedShape.id, { rx })} />
                      <NumberField label="Espessura do traço" value={selectedShape.strokeWidth} onChange={(strokeWidth) => updateShape(selectedShape.id, { strokeWidth })} />
                    </div>
                    <ColorField label="Preenchimento" value={selectedShape.fill} onChange={(fill) => updateShape(selectedShape.id, { fill })} />
                    <ColorField label="Cor do contorno" value={selectedShape.stroke} onChange={(stroke) => updateShape(selectedShape.id, { stroke })} />
                    <StrokeStyleField value={selectedShape.strokeDasharray} onChange={(strokeDasharray) => updateShape(selectedShape.id, { strokeDasharray })} />
                    <NumberField label="Opacidade" step={0.1} value={selectedShape.opacity} onChange={(opacity) => updateShape(selectedShape.id, { opacity })} />
                  </>
                )}

                {(selectedShape.type === "circle" || selectedShape.type === "ellipse") && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField label="Centro X" value={selectedShape.cx} onChange={(cx) => updateShape(selectedShape.id, { cx })} />
                      <NumberField label="Centro Y" value={selectedShape.cy} onChange={(cy) => updateShape(selectedShape.id, { cy })} />
                      {selectedShape.type === "circle" ? (
                        <NumberField label="Raio" value={selectedShape.r} onChange={(r) => updateShape(selectedShape.id, { r })} />
                      ) : (
                        <>
                          <NumberField label="Raio X" value={selectedShape.rx} onChange={(rx) => updateShape(selectedShape.id, { rx })} />
                          <NumberField label="Raio Y" value={selectedShape.ry} onChange={(ry) => updateShape(selectedShape.id, { ry })} />
                        </>
                      )}
                      <NumberField label="Espessura do traço" value={selectedShape.strokeWidth} onChange={(strokeWidth) => updateShape(selectedShape.id, { strokeWidth })} />
                    </div>
                    <ColorField label="Preenchimento" value={selectedShape.fill} onChange={(fill) => updateShape(selectedShape.id, { fill })} />
                    <ColorField label="Cor do contorno" value={selectedShape.stroke} onChange={(stroke) => updateShape(selectedShape.id, { stroke })} />
                    <StrokeStyleField value={selectedShape.strokeDasharray} onChange={(strokeDasharray) => updateShape(selectedShape.id, { strokeDasharray })} />
                    <NumberField label="Opacidade" step={0.1} value={selectedShape.opacity} onChange={(opacity) => updateShape(selectedShape.id, { opacity })} />
                  </>
                )}

                {selectedShape.type === "line" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField label="X inicial" value={selectedShape.x1} onChange={(x1) => updateShape(selectedShape.id, { x1 })} />
                      <NumberField label="Y inicial" value={selectedShape.y1} onChange={(y1) => updateShape(selectedShape.id, { y1 })} />
                      <NumberField label="X final" value={selectedShape.x2} onChange={(x2) => updateShape(selectedShape.id, { x2 })} />
                      <NumberField label="Y final" value={selectedShape.y2} onChange={(y2) => updateShape(selectedShape.id, { y2 })} />
                      <NumberField label="Espessura do traço" value={selectedShape.strokeWidth} onChange={(strokeWidth) => updateShape(selectedShape.id, { strokeWidth })} />
                    </div>
                    <ColorField label="Cor" value={selectedShape.stroke} onChange={(stroke) => updateShape(selectedShape.id, { stroke })} />
                    <StrokeStyleField value={selectedShape.strokeDasharray} onChange={(strokeDasharray) => updateShape(selectedShape.id, { strokeDasharray })} />
                    <NumberField label="Opacidade" step={0.1} value={selectedShape.opacity} onChange={(opacity) => updateShape(selectedShape.id, { opacity })} />
                  </>
                )}

                {selectedShape.type === "curve" && (
                  <>
                    <p className="text-[11px] text-zinc-600">
                      Arraste o ponto laranja no canvas para curvar a linha.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField label="X inicial" value={selectedShape.x1} onChange={(x1) => updateShape(selectedShape.id, { x1 })} />
                      <NumberField label="Y inicial" value={selectedShape.y1} onChange={(y1) => updateShape(selectedShape.id, { y1 })} />
                      <NumberField label="X final" value={selectedShape.x2} onChange={(x2) => updateShape(selectedShape.id, { x2 })} />
                      <NumberField label="Y final" value={selectedShape.y2} onChange={(y2) => updateShape(selectedShape.id, { y2 })} />
                      <NumberField label="Espessura do traço" value={selectedShape.strokeWidth} onChange={(strokeWidth) => updateShape(selectedShape.id, { strokeWidth })} />
                    </div>
                    <ColorField label="Cor" value={selectedShape.stroke} onChange={(stroke) => updateShape(selectedShape.id, { stroke })} />
                    <StrokeStyleField value={selectedShape.strokeDasharray} onChange={(strokeDasharray) => updateShape(selectedShape.id, { strokeDasharray })} />
                    <NumberField label="Opacidade" step={0.1} value={selectedShape.opacity} onChange={(opacity) => updateShape(selectedShape.id, { opacity })} />
                  </>
                )}

                {selectedShape.type === "polygon" && (
                  <>
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-zinc-500">Pontos (x,y x,y ...)</span>
                      <textarea
                        value={selectedShape.points}
                        onChange={(e) => updateShape(selectedShape.id, { points: e.target.value })}
                        rows={2}
                        className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField label="Espessura do traço" value={selectedShape.strokeWidth} onChange={(strokeWidth) => updateShape(selectedShape.id, { strokeWidth })} />
                    </div>
                    <ColorField label="Preenchimento" value={selectedShape.fill} onChange={(fill) => updateShape(selectedShape.id, { fill })} />
                    <ColorField label="Cor do contorno" value={selectedShape.stroke} onChange={(stroke) => updateShape(selectedShape.id, { stroke })} />
                    <StrokeStyleField value={selectedShape.strokeDasharray} onChange={(strokeDasharray) => updateShape(selectedShape.id, { strokeDasharray })} />
                    <NumberField label="Opacidade" step={0.1} value={selectedShape.opacity} onChange={(opacity) => updateShape(selectedShape.id, { opacity })} />
                  </>
                )}

                {selectedShape.type === "text" && (
                  <>
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-zinc-500">Conteúdo</span>
                      <input
                        type="text"
                        value={selectedShape.text}
                        onChange={(e) => updateShape(selectedShape.id, { text: e.target.value })}
                        className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField label="X" value={selectedShape.x} onChange={(x) => updateShape(selectedShape.id, { x })} />
                      <NumberField label="Y" value={selectedShape.y} onChange={(y) => updateShape(selectedShape.id, { y })} />
                      <NumberField label="Tam. fonte" value={selectedShape.fontSize} onChange={(fontSize) => updateShape(selectedShape.id, { fontSize })} />
                    </div>
                    <ColorField label="Cor" value={selectedShape.fill} onChange={(fill) => updateShape(selectedShape.id, { fill })} />
                    <NumberField label="Opacidade" step={0.1} value={selectedShape.opacity} onChange={(opacity) => updateShape(selectedShape.id, { opacity })} />
                  </>
                )}

                {selectedShape.type === "path" && (
                  <>
                    <p className="text-[11px] text-zinc-600">
                      Traços de pincel e caminhos vetoriais só podem ser movidos e recoloridos aqui
                      — o traçado em si vem do desenho livre ou do que a IA gerou.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField label="Espessura do traço" value={selectedShape.strokeWidth} onChange={(strokeWidth) => updateShape(selectedShape.id, { strokeWidth })} />
                    </div>
                    <ColorField label="Preenchimento" value={selectedShape.fill} onChange={(fill) => updateShape(selectedShape.id, { fill })} />
                    <ColorField label="Cor do contorno" value={selectedShape.stroke} onChange={(stroke) => updateShape(selectedShape.id, { stroke })} />
                    <StrokeStyleField value={selectedShape.strokeDasharray} onChange={(strokeDasharray) => updateShape(selectedShape.id, { strokeDasharray })} />
                    <NumberField label="Opacidade" step={0.1} value={selectedShape.opacity} onChange={(opacity) => updateShape(selectedShape.id, { opacity })} />
                  </>
                )}

                {selectedShape.type === "raw" && (
                  <p className="text-[11px] text-zinc-600">
                    Elemento <code className="text-zinc-400">&lt;{selectedShape.tag}&gt;</code> não suportado pelo editor
                    visual — foi preservado como está. Você pode removê-lo, mas não editá-lo aqui.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => handleRemoveShape(selectedShape.id)}
                  className="flex items-center gap-1.5 rounded-md border border-red-900/60 px-2 py-1 text-xs text-red-400 hover:bg-red-950/30"
                >
                  <Trash2 size={12} />
                  Remover elemento
                </button>
              </div>
            )}
          </div>
        </div>

        {replacedExisting && (
          <p className="mt-3 shrink-0 text-[11px] text-zinc-600">
            Ao salvar, a imagem atual da questão será substituída pelo que foi montado aqui.
          </p>
        )}

        <div className="mt-3 flex shrink-0 justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-600"
          >
            Salvar imagem
          </button>
        </div>
      </div>
    </div>
  );
}
