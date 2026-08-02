import { Alternativa, ExamData, LlmProvider, Questao, TipoQuestao } from "../types";
import { buildExamTool, buildSystemPrompt } from "./examTool";
import {
  QUESTION_EDIT_SYSTEM_PROMPT,
  QUESTION_EDIT_TOOL,
} from "./questionEditTool";
import { toGeminiSchema } from "./schemaConvert";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export class LlmApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "LlmApiError";
    this.status = status;
  }
}

// Definição de tool no formato da Anthropic (input_schema em JSON Schema "minúsculo"). Para o
// Gemini, essa mesma definição é convertida via toGeminiSchema() antes de ser enviada.
interface LlmToolDefinition {
  name: string;
  description: string;
  input_schema: unknown;
}

interface AnthropicContentBlock {
  type: string;
  input?: unknown;
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
}

async function callAnthropic(
  apiKey: string,
  model: string,
  system: string,
  userMessage: string,
  tool: LlmToolDefinition,
  maxTokens: number,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey.trim(),
        "anthropic-version": ANTHROPIC_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: userMessage }],
        tools: [tool],
        tool_choice: { type: "tool", name: tool.name },
      }),
    });
  } catch {
    throw new LlmApiError(
      "Falha de conexão com a API da Anthropic. Verifique sua internet.",
    );
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.json();
      detail = errBody?.error?.message ?? "";
    } catch {
      // corpo de erro não era JSON válido, seguimos com a mensagem genérica
    }

    if (response.status === 401) {
      throw new LlmApiError(
        "Chave de API inválida. Verifique sua chave da Anthropic.",
        401,
      );
    }
    if (response.status === 429) {
      throw new LlmApiError(
        "Limite de requisições atingido ou créditos insuficientes na conta Anthropic.",
        429,
      );
    }
    if (response.status === 400) {
      throw new LlmApiError(
        `Requisição inválida: ${detail || "verifique o modelo selecionado."}`,
        400,
      );
    }
    throw new LlmApiError(
      detail || `Erro inesperado da API da Anthropic (HTTP ${response.status}).`,
      response.status,
    );
  }

  const data = (await response.json()) as AnthropicResponse;
  const toolUseBlock = data.content.find((block) => block.type === "tool_use");

  if (!toolUseBlock) {
    throw new LlmApiError(
      "O modelo não retornou os dados estruturados esperados. Tente novamente.",
    );
  }

  return toolUseBlock.input;
}

interface GeminiPart {
  functionCall?: { name: string; args: unknown };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
}

async function callGemini(
  apiKey: string,
  model: string,
  system: string,
  userMessage: string,
  tool: LlmToolDefinition,
  maxTokens: number,
): Promise<unknown> {
  const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey.trim(),
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        tools: [
          {
            functionDeclarations: [
              {
                name: tool.name,
                description: tool.description,
                parameters: toGeminiSchema(tool.input_schema),
              },
            ],
          },
        ],
        toolConfig: {
          functionCallingConfig: { mode: "ANY", allowedFunctionNames: [tool.name] },
        },
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    });
  } catch {
    throw new LlmApiError(
      "Falha de conexão com a API do Google Gemini. Verifique sua internet.",
    );
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.json();
      detail = errBody?.error?.message ?? "";
    } catch {
      // corpo de erro não era JSON válido, seguimos com a mensagem genérica
    }

    if (response.status === 400 && /api key not valid/i.test(detail)) {
      throw new LlmApiError(
        "Chave de API inválida. Verifique sua chave do Google Gemini.",
        400,
      );
    }
    if (response.status === 401) {
      throw new LlmApiError(
        "Chave de API inválida ou ausente. Verifique sua chave do Google Gemini.",
        401,
      );
    }
    if (response.status === 403) {
      throw new LlmApiError(
        "Chave de API inválida ou sem permissão para usar este modelo do Gemini.",
        403,
      );
    }
    if (response.status === 404) {
      throw new LlmApiError(
        "Modelo do Gemini não encontrado. Verifique o modelo selecionado.",
        404,
      );
    }
    if (response.status === 429) {
      throw new LlmApiError(
        "Limite de requisições atingido ou cota insuficiente na conta do Google.",
        429,
      );
    }
    if (response.status === 400) {
      throw new LlmApiError(
        `Requisição inválida: ${detail || "verifique o modelo selecionado."}`,
        400,
      );
    }
    throw new LlmApiError(
      detail || `Erro inesperado da API do Gemini (HTTP ${response.status}).`,
      response.status,
    );
  }

  const data = (await response.json()) as GeminiResponse;
  const functionCallPart = data.candidates?.[0]?.content?.parts?.find(
    (part) => part.functionCall,
  );

  if (!functionCallPart?.functionCall) {
    throw new LlmApiError(
      "O modelo não retornou os dados estruturados esperados. Tente novamente.",
    );
  }

  return functionCallPart.functionCall.args;
}

async function callLlmTool(
  provider: LlmProvider,
  apiKey: string,
  model: string,
  system: string,
  userMessage: string,
  tool: LlmToolDefinition,
  maxTokens: number,
): Promise<unknown> {
  if (provider === "google") {
    return callGemini(apiKey, model, system, userMessage, tool, maxTokens);
  }
  return callAnthropic(apiKey, model, system, userMessage, tool, maxTokens);
}

function providerLabel(provider: LlmProvider): string {
  return provider === "google" ? "do Google Gemini" : "da Anthropic";
}

function stripBracedComma(text: string): string {
  return text.replace(/\{,\}/g, ",");
}

const MULTIPLE_CHOICE_LETTERS = ["a", "b", "c", "d"] as const;

function normalizeAlternativas(questao: Questao): Alternativa[] {
  const alternativas = questao.alternativas.map((alt, index) => ({
    ...alt,
    letra: (alt.letra || MULTIPLE_CHOICE_LETTERS[index]).toLowerCase(),
    texto: stripBracedComma(alt.texto),
  }));

  const seen = new Set<string>();
  const entradas: Alternativa[] = [];

  for (const letra of MULTIPLE_CHOICE_LETTERS) {
    const alternativa = alternativas.find(
      (alt) => alt.letra === letra && !seen.has(letra),
    );
    if (alternativa) {
      seen.add(letra);
      entradas.push({ ...alternativa, letra });
    } else {
      entradas.push({ letra, texto: "" });
    }
  }

  return entradas;
}

function normalizeQuestao(questao: Questao): Questao {
  const alternativas = normalizeAlternativas(questao);
  const respostaCorreta = questao.respostaCorreta?.toLowerCase();
  const respostaValida = MULTIPLE_CHOICE_LETTERS.includes(
    respostaCorreta as (typeof MULTIPLE_CHOICE_LETTERS)[number],
  )
    ? respostaCorreta
    : (alternativas[0]?.letra ?? "a");

  return {
    ...questao,
    enunciado: stripBracedComma(questao.enunciado),
    imagem: questao.imagem ? stripBracedComma(questao.imagem) : undefined,
    alternativas,
    respostaCorreta: respostaValida,
    resolucao: stripBracedComma(questao.resolucao),
  };
}

export async function generateExam(
  provider: LlmProvider,
  apiKey: string,
  model: string,
  userPrompt: string,
  numQuestoes: number,
): Promise<ExamData> {
  if (!apiKey.trim()) {
    throw new LlmApiError(
      `Informe sua chave de API ${providerLabel(provider)} antes de gerar a prova.`,
    );
  }
  if (!userPrompt.trim()) {
    throw new LlmApiError("Descreva o assunto da prova antes de gerar.");
  }

  const examTool = buildExamTool(numQuestoes);
  const input = await callLlmTool(
    provider,
    apiKey,
    model,
    buildSystemPrompt(numQuestoes),
    userPrompt.trim(),
    examTool,
    8000,
  );

  return sanitizeExamData(input as ExamData);
}

function sanitizeExamData(data: ExamData): ExamData {
  return {
    assunto: stripBracedComma(data.assunto),
    questoes: data.questoes.map((questao) => normalizeQuestao(questao)),
  };
}

export interface QuestionEditResult {
  tipo: TipoQuestao;
  enunciado: string;
  imagem?: string;
  alternativas: Alternativa[];
  respostaCorreta: string;
  resolucao: string;
}

export interface QuestionEditContext {
  assunto: string;
  questaoAtual?: Questao;
}

export async function editQuestion(
  provider: LlmProvider,
  apiKey: string,
  model: string,
  instruction: string,
  context: QuestionEditContext,
): Promise<QuestionEditResult> {
  if (!apiKey.trim()) {
    throw new LlmApiError(
      `Informe sua chave de API ${providerLabel(provider)} antes de usar a IA.`,
    );
  }
  if (!instruction.trim()) {
    throw new LlmApiError(
      "Descreva o que a IA deve fazer com a questão.",
    );
  }

  const messageParts = [
    `Assunto geral da prova: ${context.assunto.trim() || "não informado"}.`,
  ];
  if (context.questaoAtual) {
    messageParts.push(
      `Questão atual (parta dela e aplique apenas a mudança pedida, preservando o restante):\n${JSON.stringify(
        {
          tipo: context.questaoAtual.tipo,
          enunciado: context.questaoAtual.enunciado,
          imagem: context.questaoAtual.imagem,
          alternativas: context.questaoAtual.alternativas,
          respostaCorreta: context.questaoAtual.respostaCorreta,
          resolucao: context.questaoAtual.resolucao,
        },
        null,
        2,
      )}`,
    );
  } else {
    messageParts.push(
      "Não existe questão atual: crie uma questão nova do zero.",
    );
  }
  messageParts.push(`Instrução do professor: ${instruction.trim()}`);

  const input = await callLlmTool(
    provider,
    apiKey,
    model,
    QUESTION_EDIT_SYSTEM_PROMPT,
    messageParts.join("\n\n"),
    QUESTION_EDIT_TOOL,
    2000,
  );

  return sanitizeQuestionResult(input as QuestionEditResult);
}

function sanitizeQuestionResult(
  result: QuestionEditResult,
): QuestionEditResult {
  return {
    tipo: result.tipo,
    enunciado: stripBracedComma(result.enunciado),
    imagem: result.imagem ? stripBracedComma(result.imagem) : undefined,
    alternativas: result.alternativas.map((alt) => ({
      ...alt,
      texto: stripBracedComma(alt.texto),
    })),
    respostaCorreta: result.respostaCorreta,
    resolucao: stripBracedComma(result.resolucao),
  };
}
