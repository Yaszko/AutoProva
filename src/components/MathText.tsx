import katex from 'katex';
import { isMathSegment, mathContent, splitTextSegments } from '../lib/mathSegments';

interface MathTextProps {
  text: string;
}

function renderSegment(segment: string, key: number) {
  if (!isMathSegment(segment)) {
    return <span key={key}>{segment}</span>;
  }

  try {
    const html = katex.renderToString(mathContent(segment), { throwOnError: false });
    // eslint-disable-next-line react/no-danger -- HTML é gerado pelo KaTeX a partir de sintaxe matemática, não é HTML arbitrário
    return <span key={key} dangerouslySetInnerHTML={{ __html: html }} />;
  } catch {
    return <span key={key}>{segment}</span>;
  }
}

export function MathText({ text }: MathTextProps) {
  const segments = splitTextSegments(text);
  return <>{segments.map(renderSegment)}</>;
}
