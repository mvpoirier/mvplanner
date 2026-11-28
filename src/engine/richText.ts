// Lesson-note formatting, stored as plain text with light markup so old notes keep working:
//   **bold**   *italic*   ~~strike~~   ==highlight==   [text](https://link)
//   "- item" bullets      "1. item" numbered lists

export type InlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'bold' | 'italic' | 'strike' | 'mark'; children: InlineToken[] }
  | { kind: 'link'; text: string; href: string };

export type LineKind = 'text' | 'bullet' | 'number';
export interface ParsedLine {
  kind: LineKind;
  number?: number;
  tokens: InlineToken[];
}

const INLINE = /(\*\*(.+?)\*\*)|(~~(.+?)~~)|(==(.+?)==)|(\[([^\]]+)\]\(([^)\s]+)\))|(\*(?!\s)(.+?)\*)|(_(?!\s)(.+?)_)/;

/** Only http(s) and mailto links are ever turned into links. */
export function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^(https?:\/\/|mailto:)/i.test(h)) return h;
  if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(h)) return `https://${h}`; // "example.com/page"
  return null;
}

export function parseInline(text: string): InlineToken[] {
  const out: InlineToken[] = [];
  let rest = text;
  while (rest.length > 0) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push({ kind: 'text', text: rest });
      break;
    }
    if (m.index > 0) out.push({ kind: 'text', text: rest.slice(0, m.index) });
    if (m[1]) out.push({ kind: 'bold', children: parseInline(m[2]) });
    else if (m[3]) out.push({ kind: 'strike', children: parseInline(m[4]) });
    else if (m[5]) out.push({ kind: 'mark', children: parseInline(m[6]) });
    else if (m[7]) {
      const href = safeHref(m[9]);
      out.push(href ? { kind: 'link', text: m[8], href } : { kind: 'text', text: m[0] });
    } else if (m[10]) out.push({ kind: 'italic', children: parseInline(m[11]) });
    else if (m[12]) out.push({ kind: 'italic', children: parseInline(m[13]) });
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

export function parseLine(line: string): ParsedLine {
  const bullet = line.match(/^\s*[-•*]\s+(.*)$/);
  if (bullet) return { kind: 'bullet', tokens: parseInline(bullet[1]) };
  const num = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
  if (num) return { kind: 'number', number: Number(num[1]), tokens: parseInline(num[2]) };
  return { kind: 'text', tokens: parseInline(line) };
}

const tokensToPlain = (ts: InlineToken[]): string =>
  ts.map((t) => (t.kind === 'text' ? t.text : t.kind === 'link' ? t.text : tokensToPlain(t.children))).join('');

/** Text without any markup (for search, reminders, exports). */
export function plainText(md: string): string {
  return md
    .split('\n')
    .map((l) => {
      const p = parseLine(l);
      const body = tokensToPlain(p.tokens);
      return p.kind === 'bullet' ? `• ${body}` : p.kind === 'number' ? `${p.number}. ${body}` : body;
    })
    .join('\n');
}

// ---------- Editing helpers (operate on a textarea's value + selection) ----------

export interface EditResult {
  value: string;
  selStart: number;
  selEnd: number;
}

export const MARKERS = { bold: '**', italic: '*', strike: '~~', mark: '==' } as const;
export type WrapStyle = keyof typeof MARKERS;

/** Wrap the selection in a marker, or remove it if the selection is already wrapped. */
export function toggleWrap(value: string, selStart: number, selEnd: number, style: WrapStyle): EditResult {
  const mk = MARKERS[style];
  const before = value.slice(0, selStart);
  const sel = value.slice(selStart, selEnd);
  const after = value.slice(selEnd);
  // Already wrapped just outside the selection → unwrap
  if (before.endsWith(mk) && after.startsWith(mk) && !(style === 'italic' && before.endsWith('**'))) {
    return {
      value: before.slice(0, -mk.length) + sel + after.slice(mk.length),
      selStart: selStart - mk.length,
      selEnd: selEnd - mk.length,
    };
  }
  // Selection includes the markers → unwrap
  if (sel.length >= mk.length * 2 && sel.startsWith(mk) && sel.endsWith(mk)) {
    const inner = sel.slice(mk.length, -mk.length);
    return { value: before + inner + after, selStart, selEnd: selStart + inner.length };
  }
  if (sel.length === 0) {
    // No selection: insert an empty pair and put the caret inside
    return { value: before + mk + mk + after, selStart: selStart + mk.length, selEnd: selStart + mk.length };
  }
  return {
    value: before + mk + sel + mk + after,
    selStart: selStart + mk.length,
    selEnd: selEnd + mk.length,
  };
}

/** Turn the selected lines into a bulleted or numbered list (or back to plain lines). */
export function setList(
  value: string,
  selStart: number,
  selEnd: number,
  kind: 'bullet' | 'number' | 'none',
): EditResult {
  const lineStart = value.lastIndexOf('\n', selStart - 1) + 1;
  let lineEnd = value.indexOf('\n', selEnd);
  if (lineEnd === -1) lineEnd = value.length;
  const block = value.slice(lineStart, lineEnd).split('\n');
  const stripped = block.map((l) => l.replace(/^\s*([-•*]|\d+[.)])\s+/, ''));
  const out = stripped.map((l, i) => (kind === 'bullet' ? `- ${l}` : kind === 'number' ? `${i + 1}. ${l}` : l));
  const joined = out.join('\n');
  return {
    value: value.slice(0, lineStart) + joined + value.slice(lineEnd),
    selStart: lineStart,
    selEnd: lineStart + joined.length,
  };
}

export function insertLink(value: string, selStart: number, selEnd: number, text: string, url: string): EditResult {
  const label = (text || value.slice(selStart, selEnd) || url).replace(/[[\]]/g, '');
  const link = `[${label}](${url.trim()})`;
  return {
    value: value.slice(0, selStart) + link + value.slice(selEnd),
    selStart: selStart + link.length,
    selEnd: selStart + link.length,
  };
}

/** When Enter is pressed inside a list item, start the next item (or end the list on an empty item). */
export function continueList(value: string, caret: number): EditResult | null {
  const lineStart = value.lastIndexOf('\n', caret - 1) + 1;
  const line = value.slice(lineStart, caret);
  const b = line.match(/^(\s*[-•*]\s+)(.*)$/);
  const n = line.match(/^(\s*)(\d+)([.)]\s+)(.*)$/);
  if (!b && !n) return null;
  const empty = b ? b[2].trim() === '' : n![4].trim() === '';
  if (empty) {
    // Second Enter on an empty item ends the list
    return { value: value.slice(0, lineStart) + value.slice(caret), selStart: lineStart, selEnd: lineStart };
  }
  const prefix = b ? b[1] : `${n![1]}${Number(n![2]) + 1}${n![3]}`;
  const insert = `\n${prefix}`;
  return { value: value.slice(0, caret) + insert + value.slice(caret), selStart: caret + insert.length, selEnd: caret + insert.length };
}

// ---------- Sequences: "1/3 Titration practical" ----------

export interface SequenceStart {
  total: number;
  rest: string; // text after "1/3"
  line: string;
}

/** A line starting "1/N something" (N 2–12) begins a sequence that can be filled forward. */
export function findSequenceStart(text: string): SequenceStart | null {
  for (const line of text.split('\n')) {
    const m = line.trim().match(/^1\s*\/\s*(\d{1,2})\s+(.+)$/);
    if (m) {
      const total = Number(m[1]);
      if (total >= 2 && total <= 12) return { total, rest: m[2].trim(), line: line.trim() };
    }
  }
  return null;
}
