import { useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { LlmProvider } from '../types';
import { getProviderConfig, LLM_PROVIDERS } from '../lib/llmProviders';

interface ConfigPanelProps {
  provider: LlmProvider;
  onProviderChange: (value: LlmProvider) => void;
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  model: string;
  onModelChange: (value: string) => void;
}

export function ConfigPanel({
  provider,
  onProviderChange,
  apiKey,
  onApiKeyChange,
  model,
  onModelChange,
}: ConfigPanelProps) {
  const [visible, setVisible] = useState(false);
  const providerConfig = getProviderConfig(provider);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="mb-4 flex items-center gap-2 text-zinc-300">
        <KeyRound size={16} />
        <h2 className="text-sm font-medium uppercase tracking-wide">Configuração</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="provider" className="mb-1.5 block text-xs text-zinc-400">
            Provedor de IA
          </label>
          <select
            id="provider"
            value={provider}
            onChange={(e) => onProviderChange(e.target.value as LlmProvider)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
          >
            {LLM_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="api-key" className="mb-1.5 block text-xs text-zinc-400">
            {providerConfig.label} API Key
          </label>
          <div className="relative">
            <input
              id="api-key"
              type={visible ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder={providerConfig.apiKeyPlaceholder}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 pr-10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              aria-label={visible ? 'Ocultar chave' : 'Revelar chave'}
            >
              {visible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-zinc-600">{providerConfig.apiKeyHelp}</p>
        </div>

        <div>
          <label htmlFor="model" className="mb-1.5 block text-xs text-zinc-400">
            Modelo
          </label>
          <select
            id="model"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
          >
            {providerConfig.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
