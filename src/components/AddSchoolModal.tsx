import { useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { SchoolInfo } from "../lib/schoolInfo";

interface AddSchoolModalProps {
  onAdd: (school: SchoolInfo) => void;
  onClose: () => void;
}

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AddSchoolModal({ onAdd, onClose }: AddSchoolModalProps) {
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [logoFiles, setLogoFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 2);
    if (files.some((file) => file.size > MAX_LOGO_SIZE_BYTES)) {
      setError("Cada logo deve ter no máximo 2 MB.");
      return;
    }
    setError(null);
    setLogoFiles(files);
  }

  async function handleSubmit() {
    if (!nome.trim()) {
      setError("Informe o nome da escola.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const [logoEsquerda, logoDireita] = await Promise.all(
        logoFiles.map((file) => readFileAsDataUrl(file)),
      );
      onAdd({
        nome: nome.trim(),
        instituicao: nome.trim(),
        endereco: endereco.trim(),
        telefone: telefone.trim(),
        email: email.trim(),
        logoEsquerda,
        logoDireita,
      });
    } catch {
      setError("Não foi possível ler o(s) arquivo(s) de logo. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-300">
            Nova Escola
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

        <div className="space-y-3">
          <div>
            <label htmlFor="nova-escola-nome" className="mb-1.5 block text-xs text-zinc-400">
              Nome da escola
            </label>
            <input
              id="nova-escola-nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Colégio Estadual Exemplo"
              autoFocus
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="nova-escola-endereco" className="mb-1.5 block text-xs text-zinc-400">
              Endereço
            </label>
            <input
              id="nova-escola-endereco"
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Ex: Rua Exemplo, 123 - Cidade – Estado"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <label htmlFor="nova-escola-telefone" className="mb-1.5 block text-xs text-zinc-400">
                Telefone
              </label>
              <input
                id="nova-escola-telefone"
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="Ex: (41) 3000-0000"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="nova-escola-email" className="mb-1.5 block text-xs text-zinc-400">
                E-mail
              </label>
              <input
                id="nova-escola-email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: escola@escola.pr.gov.br"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="nova-escola-logo" className="mb-1.5 block text-xs text-zinc-400">
              Logo(s) do cabeçalho
            </label>
            <label
              htmlFor="nova-escola-logo"
              className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-700 bg-zinc-950 px-3 py-4 text-center text-xs text-zinc-500 hover:border-zinc-600 hover:text-zinc-400"
            >
              <ImagePlus size={18} />
              {logoFiles.length > 0
                ? logoFiles.map((file) => file.name).join(", ")
                : "Escolha 1 imagem (esquerda) ou 2 (esquerda e direita)"}
            </label>
            <input
              id="nova-escola-logo"
              type="file"
              accept="image/*"
              multiple
              onChange={handleLogoChange}
              className="hidden"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !nome.trim()}
              className="flex items-center gap-1.5 rounded-md bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              Adicionar escola
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
