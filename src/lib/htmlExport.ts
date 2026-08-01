function collectPageCss(): string {
  const chunks: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = sheet.cssRules;
      if (!rules) continue;
      for (const rule of Array.from(rules)) {
        chunks.push(rule.cssText);
      }
    } catch {
      // folha de estilo de origem cruzada, não é possível ler suas regras — ignora
    }
  }
  return chunks.join('\n');
}

export function buildStandaloneHtml(bodyHtml: string, title: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
body { margin: 0; padding: 24px; }
${collectPageCss()}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`;
}
