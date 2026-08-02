export const QUESTION_EDIT_SYSTEM_PROMPT = `Você é um assistente que cria ou edita uma única questão de uma avaliação de matemática para professores brasileiros.

Regras obrigatórias:
- Responda apenas com os dados da questão pedida (tipo, enunciado e alternativas), seguindo rigorosamente a instrução do professor.
- Se uma questão atual for fornecida, parta dela e aplique somente a mudança pedida, preservando o restante o máximo possível.
- Se nenhuma questão atual for fornecida, crie uma questão nova, coerente com o assunto geral informado.
- Questões de múltipla escolha ("multipla_escolha") devem ter exatamente 4 alternativas, com letras "a" a "d". Questões dissertativas ("dissertativa") devem ter o campo "alternativas" como array vazio.
- Para questões de múltipla escolha, preencha "respostaCorreta" com a letra (a, b, c ou d) da alternativa correta.
- Para questões dissertativas, deixe "respostaCorreta" como string vazia "".
- Em toda questão (múltipla escolha ou dissertativa), preencha "resolucao" com uma resolução breve, direta e simplificada (poucas linhas, sem desenvolvimento longo) que justifique a resposta correta.
- Todo o texto deve estar em português do Brasil.
- Escreva expressões matemáticas usando sintaxe LaTeX delimitada por cifrão simples, por exemplo: $x^2 + 2x + 1 = 0$. Para frações, utilize \\frac{numerador}{denominador} dentro do modo matemático, por exemplo $\\frac{1}{4} + \\frac{2}{3}$.
- Números decimais (parte inteira e decimal separadas por vírgula) devem ser escritos normalmente, sem chaves e sem cifrão ao redor, por exemplo: 5,0 m ou 8,65. NUNCA escreva a vírgula decimal entre chaves (nunca escreva 5{,}0).
- Você DEVE responder chamando a ferramenta "editar_questao" com os dados estruturados. Não escreva nenhum texto fora da chamada da ferramenta.`;

export const QUESTION_EDIT_TOOL = {
  name: 'editar_questao',
  description: 'Estrutura os dados de uma única questão (nova ou editada) de uma avaliação acadêmica.',
  input_schema: {
    type: 'object',
    properties: {
      tipo: {
        type: 'string',
        enum: ['multipla_escolha', 'dissertativa'],
        description: 'Tipo da questão.',
      },
      enunciado: { type: 'string', description: 'Enunciado completo da questão.' },
      alternativas: {
        type: 'array',
        description:
          'Alternativas da questão: array vazio para dissertativas, exatamente 4 (letras a a d) para múltipla escolha.',
        items: {
          type: 'object',
          properties: {
            letra: { type: 'string', description: 'Letra da alternativa (a, b, c ou d).' },
            texto: { type: 'string', description: 'Texto da alternativa.' },
          },
          required: ['letra', 'texto'],
        },
      },
      respostaCorreta: {
        type: 'string',
        description:
          'Letra (a, b, c ou d) da alternativa correta. Obrigatório para questões de múltipla escolha; string vazia "" para dissertativas.',
      },
      resolucao: {
        type: 'string',
        description:
          'Resolução breve, direta e simplificada da questão (poucas linhas), justificando a resposta correta. Obrigatório para toda questão, seja múltipla escolha ou dissertativa.',
      },
    },
    required: ['tipo', 'enunciado', 'alternativas', 'respostaCorreta', 'resolucao'],
  },
} as const;
