import katex from 'katex';
import type { ReactNode } from 'react';
import { isMathSegment, mathContent, splitTextSegments } from '../lib/mathSegments';
import { parseFormattingRuns } from '../lib/richTextRuns';

interface MathTextProps {
  text: string;
}

function renderTextSegment(segment: string, key: number) {
  const runs = parseFormattingRuns(segment);
  return (
    <span key={key}>
      {runs.map((run, i) => {
        let node: ReactNode = run.text;
        if (run.underline) node = <span className="underline">{node}</span>;
        if (run.italic) node = <em>{node}</em>;
        if (run.bold) node = <strong>{node}</strong>;
        if (run.fontScale !== 1) {
          return (
            <span key={i} style={{ fontSize: `${run.fontScale}em` }}>
              {node}
            </span>
          );
        }
        return <span key={i}>{node}</span>;
      })}
    </span>
  );
}

function renderSegment(segment: string, key: number) {
  if (!isMathSegment(segment)) {
    return renderTextSegment(segment, key);
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
