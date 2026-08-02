import { useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { resolveLogoSrc, SchoolInfo } from "../lib/schoolInfo";

interface SchoolFormModalProps {
  title: string;
  submitLabel: string;
  initialSchool?: SchoolInfo;
  onSave: (school: SchoolInfo) => void;
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

interface LogoPickerProps {
  id: string;
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  onError: (message: string) => void;
}

function LogoPicker({ id, label, value, onChange, onError }: LogoPickerProps) {
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      onError("Cada logo deve ter no máximo 2 MB.");
      return;
    }
    try {
      onChange(await readFileAsDataUrl(file));
    } catch {
      onError("Não foi possível ler o arquivo de logo. Tente novamente.");
    }
  }

  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-xs text-zinc-400">{label}</p>
      <div className="relative">
        <label
          htmlFor={id}
          className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-dashed border-zinc-700 bg-zinc-950 p-2 text-center text-[11px] text-zinc-500 hover:border-zinc-600 hover:text-zinc-400"
        >
          {value ? (
            <img
              src={resolveLogoSrc(value)}
              alt={label}
              className="h-full w-full object-contain"
            />
          ) : (
            <>
              <ImagePlus size={18} />
              Selecionar imagem
            </>
          )}
        </label>
        <input
          id={id}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            aria-label={`Remover ${label.toLowerCase()}`}
            title="Remover logo"
            className="absolute right-1 top-1 rounded-full bg-zinc-900/90 p-1 text-zinc-400 hover:text-red-400"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

export function SchoolFormModal({
  title,
  submitLabel,
  initialSchool,
  onSave,
  onClose,
}: SchoolFormModalProps) {
  const [nome, setNome] = useState(initialSchool?.nome ?? "");
  const [endereco, setEndereco] = useState(initialSchool?.endereco ?? "");
  const [telefone, setTelefone] = useState(initialSchool?.telefone ?? "");
  const [email, setEmail] = useState(initialSchool?.email ?? "");
  const [logoEsquerda, setLogoEsquerda] = useState(initialSchool?.logoEsquerda);
  const [logoDireita, setLogoDireita] = useState(initialSchool?.logoDireita);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!nome.trim()) {
      setError("Informe o nome da escola.");
      return;
    }
    onSave({
      nome: nome.trim(),
      instituicao: nome.trim(),
      endereco: endereco.trim(),
      telefone: telefone.trim(),
      email: email.trim(),
      logoEsquerda,
      logoDireita,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-300">{title}</h2>
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
            <label htmlFor="escola-form-nome" className="mb-1.5 block text-xs text-zinc-400">
              Nome da escola
            </label>
            <input
              id="escola-form-nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Colégio Estadual Exemplo"
              autoFocus
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="escola-form-endereco" className="mb-1.5 block text-xs text-zinc-400">
              Endereço
            </label>
            <input
              id="escola-form-endereco"
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Ex: Rua Exemplo, 123 - Cidade – Estado"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <label htmlFor="escola-form-telefone" className="mb-1.5 block text-xs text-zinc-400">
                Telefone
              </label>
              <input
                id="escola-form-telefone"
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="Ex: (41) 3000-0000"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="escola-form-email" className="mb-1.5 block text-xs text-zinc-400">
                E-mail
              </label>
              <input
                id="escola-form-email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: escola@escola.pr.gov.br"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs text-zinc-400">
              Logos do cabeçalho — como aparecem na prova, uma de cada lado do nome da escola
            </p>
            <div className="grid grid-cols-2 gap-3">
              <LogoPicker
                id="escola-form-logo-esquerda"
                label="Logo esquerda"
                value={logoEsquerda}
                onChange={setLogoEsquerda}
                onError={setError}
              />
              <LogoPicker
                id="escola-form-logo-direita"
                label="Logo direita"
                value={logoDireita}
                onChange={setLogoDireita}
                onError={setError}
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!nome.trim()}
              className="flex items-center gap-1.5 rounded-md bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
