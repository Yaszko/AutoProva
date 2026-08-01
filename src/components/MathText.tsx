import katex from 'katex';

interface MathTextProps {
  text: string;
}

function renderSegment(segment: string, key: number) {
  const isMath = segment.startsWith('$') && segment.endsWith('$') && segment.length > 1;
  if (!isMath) {
    return <span key={key}>{segment}</span>;
  }

  try {
    const html = katex.renderToString(segment.slice(1, -1), { throwOnError: false });
    // eslint-disable-next-line react/no-danger -- HTML é gerado pelo KaTeX a partir de sintaxe matemática, não é HTML arbitrário
    return <span key={key} dangerouslySetInnerHTML={{ __html: html }} />;
  } catch {
    return <span key={key}>{segment}</span>;
  }
}

export function MathText({ text }: MathTextProps) {
  const segments = text.split(/(\$[^$]*\$)/g);
  return <>{segments.map(renderSegment)}</>;
}
