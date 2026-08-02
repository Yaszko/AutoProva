# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm install       # install dependencies
npm run dev       # start Vite dev server (http://localhost:5173)
npm run build     # tsc -b type-check, then vite production build
npm run preview   # serve the production build locally
```

There is no lint script and no test suite configured — `npm run build` (which runs `tsc -b` with `strict`, `noUnusedLocals`, `noUnusedParameters`) is the only automated correctness check. Node/npm may not be on `PATH` in a fresh shell on this machine even when installed — if `node`/`npm` aren't found, check `C:\Program Files\nodejs` directly before assuming they're missing.

## Architecture

AutoProva is a client-only SPA (Vite + React + TypeScript + Tailwind, dark theme only) that generates an academic exam (default 10 questions, configurable) from a teacher's prompt using an LLM, rendered as HTML and exported as a real PDF — there is no LaTeX/Overleaf pipeline. **There is no backend** — the browser calls the selected provider's API directly. The user picks a provider (Anthropic/Claude or Google/Gemini) in `ConfigPanel`, enters that provider's own API key, and both are persisted only in `localStorage` (one key per provider, so switching providers doesn't lose the other's key — see `DEFAULT_API_KEYS`/`autoprova_api_keys` in `App.tsx`).

### Multi-provider LLM layer

[src/lib/llmProviders.ts](src/lib/llmProviders.ts) is the provider registry: `LLM_PROVIDERS` lists each provider's id, label, API-key placeholder/help text, and available models; `getProviderConfig()`/`defaultModelFor()`/`isValidModelFor()` are used by `ConfigPanel` (to render the provider + model dropdowns, the model list changing with the selected provider) and by `App.tsx` (to fall back to a valid model when the persisted one doesn't belong to the current provider, e.g. after switching providers). Adding a new provider means adding an entry here, a `call<Provider>()` function in `llmClient.ts`, and a branch in `callLlmTool()`.

[src/lib/llmClient.ts](src/lib/llmClient.ts) (formerly `anthropicClient.ts`) is provider-agnostic at the call-site: `generateExam(provider, apiKey, model, ...)` and `editQuestion(provider, apiKey, model, ...)` both take a `provider: LlmProvider` and dispatch via `callLlmTool()` to either `callAnthropic()` (Anthropic Messages API, forced tool-use via `tool_choice: {type:'tool', name}`, response parsed from the `tool_use` content block) or `callGemini()` (Gemini `generateContent` REST endpoint, forced function-calling via `toolConfig.functionCallingConfig.mode: 'ANY'`, response parsed from the `functionCall.args` part). Tool/schema definitions ([src/lib/examTool.ts](src/lib/examTool.ts), [src/lib/questionEditTool.ts](src/lib/questionEditTool.ts)) are written once in Anthropic's `input_schema` shape (JSON Schema, lowercase `type`); `toGeminiSchema()` in [src/lib/schemaConvert.ts](src/lib/schemaConvert.ts) converts that same schema into Gemini's `Schema` format (uppercase `type`, no `minItems`/`maxItems`) at request time — there is no second, hand-maintained schema for Gemini.

### Data flow

1. `App.tsx` holds all state: `provider`/`apiKeys` (per-provider, see above)/`model`/`header` (persisted via `useLocalStorage`), and `prompt`/`numQuestoes`/`exam`/`loading`/`error` (session-only `useState`).
2. `handleGenerate` calls `generateExam()` in [src/lib/llmClient.ts](src/lib/llmClient.ts), which dispatches to the selected provider's API as described above.
3. Structured output is enforced via forced tool-use/function-calling in both providers, not freeform JSON parsing: [src/lib/examTool.ts](src/lib/examTool.ts) exports `buildSystemPrompt(numQuestoes)` and `buildExamTool(numQuestoes)`, which build the Portuguese system prompt and the `gerar_prova` tool schema (with `minItems`/`maxItems` pinned to `numQuestoes`, honored by Anthropic — dropped by the Gemini conversion, which relies on the prompt instructions instead) for the requested question count. The parsed tool-call input _is_ the `ExamData` object (after `sanitizeExamData()` strips a stray `{,}` decimal-comma artifact the model occasionally emits) — no `JSON.parse`/markdown-fence stripping needed.
4. `ExamData` (shape in [src/types.ts](src/types.ts)) and `HeaderInfo` flow into [src/components/ExamPaper.tsx](src/components/ExamPaper.tsx), a single `forwardRef` component that is the **one source of truth** for what the exam looks like — math is rendered via KaTeX through the `MathText` component. There is deliberately no second, hand-maintained template: an earlier LaTeX-template version of this app let the LaTeX output drift out of sync with the on-screen preview, which is why the app now renders everything from this one component.
5. `ResultPanel` shows two tabs ("Prévia da Prova" / "Prévia do Gabarito"), both backed by the same `PreviewDocument`/`ExamPaper` pair — only the `mode` prop (`'prova'` vs `'gabarito'`) differs, so the two views can never drift out of sync with each other. Each tab derives its downloaded PDF file name from `buildDownloadFileName()` in [src/lib/fileName.ts](src/lib/fileName.ts), which combines `header.tipo`/`turma`/`valor` and `exam.assunto` (plus a "Gabarito" suffix in that mode) and strips filesystem-illegal characters. There is no raw-HTML export view — an earlier "Código HTML" tab (`HtmlCodeView`/`htmlExport.ts`) was removed as unneeded.

### Per-question AI editing

Beyond generating the whole exam, [src/components/QuestionEditor.tsx](src/components/QuestionEditor.tsx) lets the teacher add a brand-new question or edit a single existing one by typing a free-text instruction (e.g. "deixe mais fácil", "transforme em dissertativa"). This goes through a second, separate structured-output round-trip: `editQuestion()` in `llmClient.ts` calls the same underlying `callLlmTool()` dispatcher (shared with `generateExam()`) but with the `editar_questao` tool schema and system prompt from [src/lib/questionEditTool.ts](src/lib/questionEditTool.ts), sending the exam's `assunto` plus the current question (if editing rather than adding) as context so the model preserves everything not covered by the instruction. Editing a question or changing its `tipo` is otherwise done directly in local state (`updateQuestao`/`addQuestao`/`removeQuestao`) with no API call; question numbers are always kept contiguous via `renumerar()` so the printed GABARITO stays in sync. Both this tool's output and `generateExam()`'s output are run through the same `stripBracedComma()` sanitization for the `{,}` artifact.

### PDF export

`PreviewDocument`'s "Baixar PDF" button renders the mounted `ExamPaper` DOM node to a canvas via `html-to-image`'s `toCanvas()` (an SVG `foreignObject`-based capture that lets the browser draw the DOM natively) and slices it across A4 pages with `jsPDF`. `html-to-image` was chosen over `html2canvas` specifically because `html2canvas` reimplements CSS layout from scratch and mis-renders KaTeX's nested absolute-positioned/negative-margin markup (fractions/radicals came out visually broken); `html-to-image` lets the real browser renderer draw the page instead. Page breaks snap to question boundaries (`data-page-break-boundary` elements in `ExamPaper`) so a question is never split mid-line across two PDF pages — this is a plain pixel-offset search, not real CSS pagination, since the source is a rasterized image. Because export goes through `window.print()`-free canvas capture, there is no way to suppress it — but there is also no browser-injected print header/footer (URL, date, page number) to work around, which was the reason `window.print()` was replaced with this approach.

### Header metadata vs. AI-generated content

`HeaderInfo` (`professor`, `turma`, `tipo`, `valor`) are plain user-filled form fields (`HeaderFieldsForm`); the school's own info (`schoolInfo.ts`) is hardcoded since it never changes. Neither is sent to or generated by Claude — only the questions/alternatives come back from the model. The exam title shown/printed is computed deterministically by `buildExamTitle()` in [src/lib/examTitle.ts](src/lib/examTitle.ts) from `tipo`/`valor` (e.g. "Avaliação de Matemática - 3,0"), not AI-generated. "Aluno(a)" is intentionally left blank in `ExamPaper` (a printed line) for the student to fill in by hand.

### Error handling

`LlmApiError` (in `llmClient.ts`) carries an HTTP status and a Portuguese, user-facing message, thrown by both `callAnthropic()` and `callGemini()`. Known cases (invalid key, rate limit/quota, bad request, network failure, missing tool-call in the response) get specific messages per provider — the two providers report auth failures on different HTTP statuses (Anthropic: 401; Gemini: usually 400 with an "API key not valid" message, or 403), so `callGemini()` pattern-matches the error body rather than relying on status code alone. `App.tsx` catches `LlmApiError` and falls back to a generic message for anything else.
