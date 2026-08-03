import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Circle, Minus, Square, Trash2, Triangle, Type, X } from "lucide-react";
import {
  AddableShapeType,
  createDefaultShape,
  moveShapeBy,
  parseSvgDoc,
  serializeSvgDoc,
  SHAPE_TYPE_LABELS,
  SvgDoc,
  SvgShape,
} from "../lib/svgEditor";

interface ImageEditorModalProps {
  questionNumero: number;
  initialImage: string | undefined;
  onSave: (svg: string) => void;
  onClose: () => void;
}

const ADD_TOOLS: { type: AddableShapeType; label: string; icon: typeof Square }[] = [
  { type: "rect", label: "Retângulo", icon: Square },
  { type: "circle", label: "Círculo", icon: Circle },
  { type: "polygon", label: "Triângulo", icon: Triangle },
  { type: "line", label: "Linha", icon: Minus },
  { type: "text", label: "Texto", icon: Type },
];

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

interface ShapeElementProps {
  shape: SvgShape;
  onPointerDown: (e: React.PointerEvent, shape: SvgShape) => void;
  registerRef: (id: string, el: SVGGraphicsElement | null) => void;
}

function ShapeElement({ shape, onPointerDown, registerRef }: ShapeElementProps) {
  const cursor = shape.type === "raw" ? undefined : "grab";
  const commonProps = {
    onPointerDown: (e: React.PointerEvent) => onPointerDown(e, shape),
    style: { cursor, outline: "none" as const },
  };

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
          opacity={shape.opacity}
          {...commonProps}
        />
      );
    case "raw":
      return (
        <g
          ref={(el) => registerRef(shape.id, el)}
          onPointerDown={(e) => onPointerDown(e, shape)}
          style={{ outline: "none" }}
          dangerouslySetInnerHTML={{ __html: shape.markup }}
        />
      );
  }
}

interface DragState {
  id: string;
  startPoint: { x: number; y: number };
  startShape: SvgShape;
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

  useEffect(() => {
    if (!draggingId) return;

    function toSvgPoint(clientX: number, clientY: number) {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const ctm = svg.getScreenCTM();
      if (!ctm) return { x: 0, y: 0 };
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const transformed = point.matrixTransform(ctm.inverse());
      return { x: transformed.x, y: transformed.y };
    }

    function handleMove(e: PointerEvent) {
      const drag = dragStateRef.current;
      if (!drag) return;
      const current = toSvgPoint(e.clientX, e.clientY);
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

  function handleShapePointerDown(e: React.PointerEvent, shape: SvgShape) {
    e.stopPropagation();
    setSelectedId(shape.id);
    if (shape.type === "raw") return;
    const svg = svgRef.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const point = svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    const transformed = point.matrixTransform(ctm.inverse());
    dragStateRef.current = { id: shape.id, startPoint: { x: transformed.x, y: transformed.y }, startShape: shape };
    setDraggingId(shape.id);
  }

  function updateShape(id: string, patch: Record<string, unknown>) {
    setDoc((prev) => ({
      ...prev,
      shapes: prev.shapes.map((s) => (s.id === id ? ({ ...s, ...patch } as SvgShape) : s)),
    }));
  }

  function handleAddShape(type: AddableShapeType) {
    const shape = createDefaultShape(type, doc);
    setDoc((prev) => ({ ...prev, shapes: [...prev.shapes, shape] }));
    setSelectedId(shape.id);
  }

  function handleRemoveShape(id: string) {
    setDoc((prev) => ({ ...prev, shapes: prev.shapes.filter((s) => s.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  }

  function handleSave() {
    onSave(serializeSvgDoc(doc));
  }

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
          {ADD_TOOLS.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => handleAddShape(type)}
              className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[1fr_260px]">
          <div className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-50 p-2">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${doc.width} ${doc.height}`}
              className="max-h-full max-w-full"
              style={{ width: "100%", height: "auto" }}
              onPointerDown={() => setSelectedId(null)}
            >
              {doc.shapes.map((shape) => (
                <ShapeElement
                  key={shape.id}
                  shape={shape}
                  onPointerDown={handleShapePointerDown}
                  registerRef={registerShapeRef}
                />
              ))}
              {selectionBox && (
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
            </svg>
          </div>

          <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
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
                  Nenhum elemento ainda. Use os botões acima para adicionar formas.
                </p>
              ) : (
                <ul className="space-y-1">
                  {doc.shapes.map((shape, index) => (
                    <li key={shape.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(shape.id)}
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
                      <NumberField label="Contorno" value={selectedShape.strokeWidth} onChange={(strokeWidth) => updateShape(selectedShape.id, { strokeWidth })} />
                    </div>
                    <ColorField label="Preenchimento" value={selectedShape.fill} onChange={(fill) => updateShape(selectedShape.id, { fill })} />
                    <ColorField label="Cor do contorno" value={selectedShape.stroke} onChange={(stroke) => updateShape(selectedShape.id, { stroke })} />
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
                      <NumberField label="Contorno" value={selectedShape.strokeWidth} onChange={(strokeWidth) => updateShape(selectedShape.id, { strokeWidth })} />
                    </div>
                    <ColorField label="Preenchimento" value={selectedShape.fill} onChange={(fill) => updateShape(selectedShape.id, { fill })} />
                    <ColorField label="Cor do contorno" value={selectedShape.stroke} onChange={(stroke) => updateShape(selectedShape.id, { stroke })} />
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
                      <NumberField label="Espessura" value={selectedShape.strokeWidth} onChange={(strokeWidth) => updateShape(selectedShape.id, { strokeWidth })} />
                    </div>
                    <ColorField label="Cor" value={selectedShape.stroke} onChange={(stroke) => updateShape(selectedShape.id, { stroke })} />
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
                      <NumberField label="Contorno" value={selectedShape.strokeWidth} onChange={(strokeWidth) => updateShape(selectedShape.id, { strokeWidth })} />
                    </div>
                    <ColorField label="Preenchimento" value={selectedShape.fill} onChange={(fill) => updateShape(selectedShape.id, { fill })} />
                    <ColorField label="Cor do contorno" value={selectedShape.stroke} onChange={(stroke) => updateShape(selectedShape.id, { stroke })} />
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
                      Caminhos vetoriais (path) só podem ser movidos e recoloridos aqui — o traçado em si vem do que a IA gerou.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField label="Contorno" value={selectedShape.strokeWidth} onChange={(strokeWidth) => updateShape(selectedShape.id, { strokeWidth })} />
                    </div>
                    <ColorField label="Preenchimento" value={selectedShape.fill} onChange={(fill) => updateShape(selectedShape.id, { fill })} />
                    <ColorField label="Cor do contorno" value={selectedShape.stroke} onChange={(stroke) => updateShape(selectedShape.id, { stroke })} />
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
