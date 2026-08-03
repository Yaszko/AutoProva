import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { LlmApiError } from "../lib/llmClient";

function errorMessage(err: unknown): string {
  return err instanceof LlmApiError
    ? err.message
    : "Ocorreu um erro inesperado ao consultar a IA.";
}

interface AiPanelProps {
  placeholder: string;
  submitLabel: string;
  onSubmit: (instruction: string) => Promise<void>;
  onDone: () => void;
}

export function AiPanel({ placeholder, submitLabel, onSubmit, onDone }: AiPanelProps) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      await onSubmit(instruction);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2 space-y-2 rounded-md border border-violet-800/60 bg-violet-950/20 p-2">
      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder={placeholder}
        rows={2}
        autoFocus
        className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-violet-600 focus:outline-none"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onDone}
          disabled={loading}
          className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 disabled:cursor-not-allowed"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !instruction.trim()}
          className="flex items-center gap-1 rounded-md bg-violet-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Sparkles size={12} />
          )}
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
