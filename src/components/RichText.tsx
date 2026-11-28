// Renders lesson-note markup (bold, italic, strike, highlight, links, lists). Never uses innerHTML.

import React from 'react';
import { parseLine, type InlineToken } from '../engine/richText';

export const RichInline: React.FC<{ tokens: InlineToken[] }> = ({ tokens }) => (
  <>
    {tokens.map((t, i) => {
      switch (t.kind) {
        case 'text':
          return <React.Fragment key={i}>{t.text}</React.Fragment>;
        case 'bold':
          return <strong key={i}><RichInline tokens={t.children} /></strong>;
        case 'italic':
          return <em key={i}><RichInline tokens={t.children} /></em>;
        case 'strike':
          return <s key={i} className="opacity-70"><RichInline tokens={t.children} /></s>;
        case 'mark':
          return <mark key={i} className="note-mark"><RichInline tokens={t.children} /></mark>;
        case 'link':
          return (
            <a
              key={i}
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              className="note-link"
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              {t.text}
            </a>
          );
      }
    })}
  </>
);

/** One rendered line, with its bullet or number. */
export const RichLine: React.FC<{ line: string; prefix?: React.ReactNode }> = ({ line, prefix }) => {
  const p = parseLine(line);
  return (
    <>
      {prefix}
      {p.kind === 'bullet' && <span className="note-bullet">•</span>}
      {p.kind === 'number' && <span className="note-bullet">{p.number}.</span>}
      <RichInline tokens={p.tokens} />
    </>
  );
};
