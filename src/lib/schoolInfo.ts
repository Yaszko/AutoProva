export type SchoolId = string;

export interface SchoolInfo {
  /** Nome curto exibido no seletor de escola. */
  nome: string;
  /** Nome completo exibido no cabeçalho da prova. */
  instituicao: string;
  endereco: string;
  telefone: string;
  email: string;
  /**
   * Logo exibido à esquerda do cabeçalho: nome de arquivo em /public (escolas pré-cadastradas)
   * ou data URI (escolas adicionadas pelo usuário). Ausente = nenhum logo nesse lado.
   */
  logoEsquerda?: string;
  /** Logo exibido à direita do cabeçalho. Mesmas regras de {@link SchoolInfo.logoEsquerda}. */
  logoDireita?: string;
}

// Nenhuma escola vem pré-cadastrada: o usuário deve adicionar a(s) própria(s) escola(s) pelo
// botão "+" (ver AddSchoolModal.tsx). "" representa "nenhuma escola selecionada".
export const DEFAULT_SCHOOL: SchoolId = "";

export const SCHOOLS: Record<SchoolId, SchoolInfo> = {};

// Logos de escolas pré-cadastradas são nomes de arquivo relativos a /public; logos de escolas
// adicionadas pelo usuário já chegam prontos como data URI (data:image/...). Só o primeiro caso
// precisa do prefixo do BASE_URL do Vite.
export function resolveLogoSrc(logo: string): string {
  if (logo.startsWith("data:") || logo.startsWith("http")) return logo;
  return `${import.meta.env.BASE_URL}${logo}`;
}

// Gera um id de escola a partir do nome digitado (slug sem acentos), evitando colisão com ids
// já existentes (pré-cadastrados ou outras escolas customizadas).
export function createSchoolId(
  nome: string,
  existingIds: Iterable<string>,
): string {
  const base =
    nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "escola";

  const taken = new Set(existingIds);
  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}
