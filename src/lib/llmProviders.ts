import { LlmProvider } from '../types';

export interface LlmModelOption {
  id: string;
  label: string;
}

export interface LlmProviderConfig {
  id: LlmProvider;
  label: string;
  apiKeyPlaceholder: string;
  apiKeyHelp: string;
  models: LlmModelOption[];
}

export const LLM_PROVIDERS: LlmProviderConfig[] = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    apiKeyPlaceholder: 'sk-ant-...',
    apiKeyHelp: 'Sua chave é salva apenas no seu navegador (localStorage) e enviada diretamente à Anthropic.',
    models: [
      { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 (recomendado)' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (mais rápido)' },
      { id: 'claude-opus-5', label: 'Claude Opus 5 (mais elaborado)' },
    ],
  },
  {
    id: 'google',
    label: 'Google (Gemini)',
    apiKeyPlaceholder: 'AIza...',
    apiKeyHelp: 'Sua chave é salva apenas no seu navegador (localStorage) e enviada diretamente ao Google.',
    models: [
      { id: 'gemini-flash-latest', label: 'Gemini Flash (recomendado)' },
      { id: 'gemini-flash-lite-latest', label: 'Gemini Flash-Lite (mais rápido)' },
      { id: 'gemini-pro-latest', label: 'Gemini Pro (mais elaborado)' },
    ],
  },
];

export function getProviderConfig(provider: LlmProvider): LlmProviderConfig {
  const config = LLM_PROVIDERS.find((p) => p.id === provider);
  if (!config) throw new Error(`Provedor de IA desconhecido: ${provider}`);
  return config;
}

export function defaultModelFor(provider: LlmProvider): string {
  return getProviderConfig(provider).models[0].id;
}

export function isValidModelFor(provider: LlmProvider, model: string): boolean {
  return getProviderConfig(provider).models.some((m) => m.id === model);
}
