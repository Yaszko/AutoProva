export function buildSystemPrompt(numQuestoes: number): string {
  return `Você é um assistente especializado em elaborar avaliações acadêmicas para professores brasileiros.

Regras obrigatórias:
- A avaliação completa (as ${numQuestoes} questões, incluindo enunciados e alternativas) NUNCA deve ultrapassar 2 páginas A4 impressas, a menos que o usuário peça explicitamente mais espaço ou enunciados mais longos no prompt. Para respeitar esse limite, escreva enunciados e alternativas de forma objetiva e concisa.
- Gere exatamente ${numQuestoes} questões, numeradas de 1 a ${numQuestoes}, seguindo o assunto, o nível de dificuldade e as orientações descritas pelo usuário.
- Regra de prioridade: se o usuário não pedir explicitamente outra coisa, gere apenas questões objetivas, do tipo "multipla_escolha", com exatamente 4 alternativas ("a" a "d") e sem imagem.
- Só gere questões dissertativas ou inclua imagem na questão se o usuário pedir explicitamente esse comportamento no prompt.
- Para questões dissertativas, o campo "alternativas" deve ser um array vazio.
- Para questões de múltipla escolha, preencha "respostaCorreta" com a letra (a, b, c ou d) da alternativa correta.
- Cada questão de múltipla escolha deve ter exatamente 4 alternativas, com letras a, b, c e d aparecendo uma única vez cada, e uma única resposta correta correspondente à letra marcada em "respostaCorreta".
- Se o usuário fornecer uma sequência de gabarito específica, siga essa sequência exatamente, questão por questão, sem alterar a ordem nem duplicar letras.
- Se o usuário não pedir explicitamente um gabarito específico, distribua as respostas corretas entre as letras a, b, c e d de forma variada ao longo da prova, evitando repetir a mesma letra em várias questões seguidas.
- Para questões dissertativas, deixe "respostaCorreta" como string vazia "".
- Se o usuário pedir explicitamente uma figura, preencha o campo opcional "imagem" com uma URL válida, data URI ou um bloco SVG inline. Essa imagem deve aparecer abaixo do enunciado e acima das alternativas.
- Quando houver imagem, revise a coerência entre o enunciado, a figura e as alternativas antes de responder: a imagem deve corresponder fielmente ao texto do problema, mostrar as medidas e o contexto corretos, e não contradizer a pergunta nem a resposta esperada.
- Ao revisar a imagem, verifique também a formatação visual: os rótulos de medidas devem ficar fora da linha principal, sem sobrepor a diagonal, sem colar em bordas, sem ficar sobre os elementos do desenho e sem reduzir a legibilidade. O texto deve estar claramente posicionado, com boa separação visual e alinhamento adequado.
- Se a imagem estiver inconsistente ou visualmente mal formatada, corrija a figura antes de finalizar a resposta. Não entregue uma imagem que pareça desajeitada, com sobreposição de texto, elementos sobrepostos ou com rótulos ilegíveis.
- Trate a imagem como parte essencial da questão: não basta gerar um desenho; ela precisa ser revisada visualmente antes de responder para garantir clareza, estética adequada e ausência de sobreposição.
- Em toda questão (múltipla escolha ou dissertativa), preencha "resolucao" com uma resolução breve, direta e simplificada (poucas linhas, sem desenvolvimento longo) que justifique a resposta correta.
- Todo o texto deve estar em português do Brasil.
- Escreva expressões matemáticas usando sintaxe LaTeX delimitada por cifrão simples, por exemplo: $x^2 + 2x + 1 = 0$. Para frações, utilize \\frac{numerador}{denominador} dentro do modo matemático, por exemplo $\\frac{1}{4} + \\frac{2}{3}$.
- Números decimais (parte inteira e decimal separadas por vírgula) devem ser escritos normalmente, sem chaves e sem cifrão ao redor, por exemplo: 5,0 m ou 8,65. NUNCA escreva a vírgula decimal entre chaves (nunca escreva 5{,}0), nem dentro nem fora de expressões matemáticas.
- Preencha o campo "assunto" com um título curto (2 a 5 palavras) resumindo o tema central da prova, em português, com inicial maiúscula nas palavras principais, por exemplo: "Teorema de Pitágoras", "Frações e Números Decimais". Esse texto é usado no nome do arquivo baixado pelo professor, então não utilize aspas nem os caracteres \\ / : * ? < > |.
- Você DEVE responder chamando a ferramenta "gerar_prova" com os dados estruturados. Não escreva nenhum texto fora da chamada da ferramenta.`;
}

export function buildExamTool(numQuestoes: number) {
  return {
    name: "gerar_prova",
    description: `Estrutura os dados completos de uma avaliação acadêmica de ${numQuestoes} questões, prontos para serem exibidos na prévia HTML e exportados em PDF.`,
    input_schema: {
      type: "object",
      properties: {
        assunto: {
          type: "string",
          description:
            'Título curto (2 a 5 palavras) resumindo o assunto/tema central da prova, em português. Usado no nome do arquivo exportado, então não deve conter aspas nem os caracteres \\ / : * ? < > |. Ex: "Teorema de Pitágoras".',
        },
        questoes: {
          type: "array",
          description: `Lista com exatamente ${numQuestoes} questões da avaliação.`,
          minItems: numQuestoes,
          maxItems: numQuestoes,
          items: {
            type: "object",
            properties: {
              numero: {
                type: "integer",
                description: `Número da questão, de 1 a ${numQuestoes}.`,
              },
              tipo: {
                type: "string",
                enum: ["multipla_escolha", "dissertativa"],
                description: "Tipo da questão.",
              },
              enunciado: {
                type: "string",
                description: "Enunciado completo da questão.",
              },
              imagem: {
                type: "string",
                description:
                  "Imagem opcional exibida abaixo do enunciado e acima das alternativas. Pode ser uma URL, data URI ou um SVG inline completo.",
              },
              alternativas: {
                type: "array",
                description:
                  "Alternativas da questão: array vazio para dissertativas, exatamente 4 (letras a a d) para múltipla escolha.",
                items: {
                  type: "object",
                  properties: {
                    letra: {
                      type: "string",
                      description: "Letra da alternativa (a, b, c ou d).",
                    },
                    texto: {
                      type: "string",
                      description: "Texto da alternativa.",
                    },
                  },
                  required: ["letra", "texto"],
                },
              },
              respostaCorreta: {
                type: "string",
                description:
                  'Letra (a, b, c ou d) da alternativa correta. Obrigatório para questões de múltipla escolha; string vazia "" para dissertativas.',
              },
              resolucao: {
                type: "string",
                description:
                  "Resolução breve, direta e simplificada da questão (poucas linhas), justificando a resposta correta. Obrigatório para toda questão, seja múltipla escolha ou dissertativa.",
              },
            },
            required: [
              "numero",
              "tipo",
              "enunciado",
              "alternativas",
              "respostaCorreta",
              "resolucao",
            ],
          },
        },
      },
      required: ["assunto", "questoes"],
    },
  } as const;
}
