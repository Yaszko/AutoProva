import { useEffect, useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Underline } from "lucide-react";
import { TextStyle } from "../types";
import { adjustFontScale, FONT_SCALE_STEP, toggleWrap } from "../lib/richTextRuns";
import { MathText } from "./MathText";

interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Permite quebras de linha (Enter) e cresce por várias linhas — usado no enunciado. Sem isso
   * (alternativas), Enter confirma a edição em vez de quebrar linha. */
  multiline?: boolean;
  ariaLabel?: string;
  /** Alinhamento de parágrafo — só passado pelo enunciado; alternativas não mostram esse controle
   * (não faz sentido centralizar/alinhar um texto curto de alternativa). Tamanho de fonte (A-/A+)
   * já não é mais de parágrafo — ver applyFontScale, aplica só na seleção atual do textarea. */
  paragraphStyle?: TextStyle;
  onParagraphStyleChange?: (style: TextStyle) => void;
}

interface ToolbarButtonProps {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}

function ToolbarButton({ active, onClick, label, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      // Mantém o foco/seleção do textarea intactos até o clique disparar — senão o blur do
      // textarea (disparado antes do click) já teria perdido a seleção que o toggleWrap precisa.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded px-1.5 py-1 text-xs ${active ? "bg-violet-200 text-violet-800" : "text-zinc-600 hover:bg-zinc-200"}`}
    >
      {children}
    </button>
  );
}

// Editor "clique para editar": mostra o texto renderizado (com matemática via MathText) e, ao
// clicar, troca para um textarea com o texto cru (incluindo a sintaxe $...$ e os marcadores de
// formatação **negrito**/*itálico*/__sublinhado__), já que não é seguro tornar a saída do KaTeX
// diretamente editável. Salva ao perder o foco; Escape cancela.
export function EditableText({
  value,
  onChange,
  placeholder,
  multiline,
  ariaLabel,
  paragraphStyle,
  onParagraphStyleChange,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    if (pendingSelection.current) {
      el.setSelectionRange(pendingSelection.current.start, pendingSelection.current.end);
      pendingSelection.current = null;
    }
  }, [editing, draft]);

  function startEditing() {
    setDraft(value);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    if (draft !== value) onChange(draft);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  function applyMarker(open: string) {
    const el = textareaRef.current;
    if (!el) return;
    const result = toggleWrap(draft, el.selectionStart, el.selectionEnd, open);
    pendingSelection.current = { start: result.selStart, end: result.selEnd };
    setDraft(result.text);
    el.focus();
  }

  // Tamanho de fonte age só sobre o trecho selecionado no textarea (marcador [[N]]...[[/]], ver
  // richTextRuns.ts) — não é mais um estilo de parágrafo, então nunca muda o resto do texto.
  function applyFontScale(delta: number) {
    const el = textareaRef.current;
    if (!el) return;
    const result = adjustFontScale(draft, el.selectionStart, el.selectionEnd, delta);
    pendingSelection.current = { start: result.selStart, end: result.selEnd };
    setDraft(result.text);
    el.focus();
  }

  function updateParagraphStyle(patch: Partial<TextStyle>) {
    onParagraphStyleChange?.({ ...paragraphStyle, ...patch });
  }

  if (editing) {
    const align = paragraphStyle?.align ?? "left";
    return (
      <span className="inline-block w-full align-top">
        <span className="mb-1 flex flex-wrap items-center gap-0.5 rounded border border-zinc-200 bg-zinc-100 p-0.5">
          <ToolbarButton label="Negrito" onClick={() => applyMarker("**")}>
            <Bold size={12} />
          </ToolbarButton>
          <ToolbarButton label="Itálico" onClick={() => applyMarker("*")}>
            <Italic size={12} />
          </ToolbarButton>
          <ToolbarButton label="Sublinhado" onClick={() => applyMarker("__")}>
            <Underline size={12} />
          </ToolbarButton>
          <span className="mx-0.5 h-4 w-px bg-zinc-300" />
          <ToolbarButton label="Diminuir fonte do texto selecionado" onClick={() => applyFontScale(-FONT_SCALE_STEP)}>
            <span className="text-[10px] font-bold">A-</span>
          </ToolbarButton>
          <ToolbarButton label="Aumentar fonte do texto selecionado" onClick={() => applyFontScale(FONT_SCALE_STEP)}>
            <span className="text-xs font-bold">A+</span>
          </ToolbarButton>
          {onParagraphStyleChange && (
            <>
              <span className="mx-0.5 h-4 w-px bg-zinc-300" />
              <ToolbarButton active={align === "left"} label="Alinhar à esquerda" onClick={() => updateParagraphStyle({ align: "left" })}>
                <AlignLeft size={12} />
              </ToolbarButton>
              <ToolbarButton active={align === "center"} label="Centralizar" onClick={() => updateParagraphStyle({ align: "center" })}>
                <AlignCenter size={12} />
              </ToolbarButton>
              <ToolbarButton active={align === "right"} label="Alinhar à direita" onClick={() => updateParagraphStyle({ align: "right" })}>
                <AlignRight size={12} />
              </ToolbarButton>
            </>
          )}
        </span>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            } else if (e.key === "Enter" && !multiline && !e.shiftKey) {
              e.preventDefault();
              commit();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
              e.preventDefault();
              applyMarker("**");
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
              e.preventDefault();
              applyMarker("*");
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "u") {
              e.preventDefault();
              applyMarker("__");
            }
          }}
          autoFocus
          rows={1}
          aria-label={ariaLabel}
          className="w-full resize-none overflow-hidden rounded border border-dashed border-violet-400 bg-violet-50 px-1 py-0.5 align-top text-inherit outline-none"
        />
      </span>
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={startEditing}
      onKeyDown={(e) => {
        if (e.key === "Enter") startEditing();
      }}
      aria-label={ariaLabel}
      className="inline cursor-text rounded px-0.5 py-0.5 hover:bg-violet-100"
    >
      {value.trim() ? (
        <MathText text={value} />
      ) : (
        <span className="text-zinc-400">{placeholder ?? "Clique para editar"}</span>
      )}
    </span>
  );
}
