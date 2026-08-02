// Converte um JSON Schema no formato usado pelas tools da Anthropic (type em minúsculas,
// ex: "object"/"string"/"array") para o formato de Schema aceito pelo function calling do
// Gemini (type em maiúsculas, ex: "OBJECT"/"STRING"/"ARRAY", sem minItems/maxItems).
export function toGeminiSchema(schema: unknown): unknown {
  if (schema === null || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map((item) => toGeminiSchema(item));

  const source = schema as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  if (typeof source.type === 'string') {
    result.type = source.type.toUpperCase();
  }
  if (typeof source.description === 'string') {
    result.description = source.description;
  }
  if (Array.isArray(source.enum)) {
    result.enum = source.enum;
  }
  if (Array.isArray(source.required)) {
    result.required = source.required;
  }
  if (source.items !== undefined) {
    result.items = toGeminiSchema(source.items);
  }
  if (source.properties && typeof source.properties === 'object') {
    result.properties = Object.fromEntries(
      Object.entries(source.properties as Record<string, unknown>).map(([key, value]) => [
        key,
        toGeminiSchema(value),
      ]),
    );
  }

  return result;
}
