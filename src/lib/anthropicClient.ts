import { Alternativa, ExamData, Questao, TipoQuestao } from '../types';
import { buildExamTool, buildSystemPrompt } from './examTool';
import { QUESTION_EDIT_SYSTEM_PROMPT, QUESTION_EDIT_TOOL } from './questionEditTool';

const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export class AnthropicApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AnthropicApiError';
    this.status = status;
  }
}

interface AnthropicToolDefinition {
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

async function callAnthropicTool(
  apiKey: string,
  model: string,
  system: string,
  userMessage: string,
  tool: AnthropicToolDefinition,
  maxTokens: number,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userMessage }],
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name },
      }),
    });
  } catch {
    throw new AnthropicApiError('Falha de conexão com a API da Anthropic. Verifique sua internet.');
  }

  if (!response.ok) {
    let detail = '';
    try {
      const errBody = await response.json();
      detail = errBody?.error?.message ?? '';
    } catch {
      // corpo de erro não era JSON válido, seguimos com a mensagem genérica
    }

    if (response.status === 401) {
      throw new AnthropicApiError('Chave de API inválida. Verifique sua ANTHROPIC_API_KEY.', 401);
    }
    if (response.status === 429) {
      throw new AnthropicApiError(
        'Limite de requisições atingido ou créditos insuficientes na conta Anthropic.',
        429,
      );
    }
    if (response.status === 400) {
      throw new AnthropicApiError(`Requisição inválida: ${detail || 'verifique o modelo selecionado.'}`, 400);
    }
    throw new AnthropicApiError(detail || `Erro inesperado da API (HTTP ${response.status}).`, response.status);
  }

  const data = (await response.json()) as AnthropicResponse;
  const toolUseBlock = data.content.find((block) => block.type === 'tool_use');

  if (!toolUseBlock) {
    throw new AnthropicApiError('O modelo não retornou os dados estruturados esperados. Tente novamente.');
  }

  return toolUseBlock.input;
}

function stripBracedComma(text: string): string {
  return text.replace(/\{,\}/g, ',');
}

export async function generateExam(
  apiKey: string,
  model: string,
  userPrompt: string,
  numQuestoes: number,
): Promise<ExamData> {
  if (!apiKey.trim()) {
    throw new AnthropicApiError('Informe sua chave de API da Anthropic antes de gerar a prova.');
  }
  if (!userPrompt.trim()) {
    throw new AnthropicApiError('Descreva o assunto da prova antes de gerar.');
  }

  const examTool = buildExamTool(numQuestoes);
  const input = await callAnthropicTool(
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
    questoes: data.questoes.map((questao) => ({
      ...questao,
      enunciado: stripBracedComma(questao.enunciado),
      alternativas: questao.alternativas.map((alt) => ({ ...alt, texto: stripBracedComma(alt.texto) })),
    })),
  };
}

export interface QuestionEditResult {
  tipo: TipoQuestao;
  enunciado: string;
  alternativas: Alternativa[];
}

export interface QuestionEditContext {
  assunto: string;
  questaoAtual?: Questao;
}

export async function editQuestion(
  apiKey: string,
  model: string,
  instruction: string,
  context: QuestionEditContext,
): Promise<QuestionEditResult> {
  if (!apiKey.trim()) {
    throw new AnthropicApiError('Informe sua chave de API da Anthropic antes de usar a IA.');
  }
  if (!instruction.trim()) {
    throw new AnthropicApiError('Descreva o que a IA deve fazer com a questão.');
  }

  const messageParts = [`Assunto geral da prova: ${context.assunto.trim() || 'não informado'}.`];
  if (context.questaoAtual) {
    messageParts.push(
      `Questão atual (parta dela e aplique apenas a mudança pedida, preservando o restante):\n${JSON.stringify(
        {
          tipo: context.questaoAtual.tipo,
          enunciado: context.questaoAtual.enunciado,
          alternativas: context.questaoAtual.alternativas,
        },
        null,
        2,
      )}`,
    );
  } else {
    messageParts.push('Não existe questão atual: crie uma questão nova do zero.');
  }
  messageParts.push(`Instrução do professor: ${instruction.trim()}`);

  const input = await callAnthropicTool(
    apiKey,
    model,
    QUESTION_EDIT_SYSTEM_PROMPT,
    messageParts.join('\n\n'),
    QUESTION_EDIT_TOOL,
    2000,
  );

  return sanitizeQuestionResult(input as QuestionEditResult);
}

function sanitizeQuestionResult(result: QuestionEditResult): QuestionEditResult {
  return {
    tipo: result.tipo,
    enunciado: stripBracedComma(result.enunciado),
    alternativas: result.alternativas.map((alt) => ({ ...alt, texto: stripBracedComma(alt.texto) })),
  };
}
