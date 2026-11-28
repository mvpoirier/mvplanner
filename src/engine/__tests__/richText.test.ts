import { describe, expect, it } from 'vitest';
import {
  continueList,
  findSequenceStart,
  insertLink,
  parseInline,
  parseLine,
  plainText,
  safeHref,
  setList,
  toggleWrap,
} from '../richText';

describe('Lesson note formatting', () => {
  it('parses bold, italic, strike, highlight and links', () => {
    expect(parseInline('a **b** *c* ~~d~~ ==e== [f](https://x.org)')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'bold', children: [{ kind: 'text', text: 'b' }] },
      { kind: 'text', text: ' ' },
      { kind: 'italic', children: [{ kind: 'text', text: 'c' }] },
      { kind: 'text', text: ' ' },
      { kind: 'strike', children: [{ kind: 'text', text: 'd' }] },
      { kind: 'text', text: ' ' },
      { kind: 'mark', children: [{ kind: 'text', text: 'e' }] },
      { kind: 'text', text: ' ' },
      { kind: 'link', text: 'f', href: 'https://x.org' },
    ]);
  });

  it('never makes javascript: or other unsafe links', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(parseInline('[x](javascript:alert(1))')[0].kind).toBe('text');
    expect(safeHref('docs.google.com/d/1')).toBe('https://docs.google.com/d/1');
  });

  it('recognises bullets and numbered lines', () => {
    expect(parseLine('- one').kind).toBe('bullet');
    expect(parseLine('2. two')).toMatchObject({ kind: 'number', number: 2 });
    expect(parseLine('plain').kind).toBe('text');
  });

  it('strips markup for search and reminders', () => {
    expect(plainText('**Lab** — ==due Fri==\n- [Sheet](https://x.org)')).toBe('Lab — due Fri\n• Sheet');
  });

  it('wraps and unwraps a selection', () => {
    const w = toggleWrap('make bold here', 5, 9, 'bold');
    expect(w.value).toBe('make **bold** here');
    expect(toggleWrap(w.value, w.selStart, w.selEnd, 'bold').value).toBe('make bold here');
    expect(toggleWrap('x', 1, 1, 'mark')).toEqual({ value: 'x====', selStart: 3, selEnd: 3 });
  });

  it('turns lines into lists and back', () => {
    const b = setList('a\nb', 0, 3, 'bullet');
    expect(b.value).toBe('- a\n- b');
    expect(setList(b.value, 0, b.value.length, 'number').value).toBe('1. a\n2. b');
    expect(setList('1. a\n2. b', 0, 9, 'none').value).toBe('a\nb');
  });

  it('continues a list on Enter and ends it on an empty item', () => {
    expect(continueList('- a', 3)?.value).toBe('- a\n- ');
    expect(continueList('1. a', 4)?.value).toBe('1. a\n2. ');
    expect(continueList('- a\n- ', 6)?.value).toBe('- a\n');
    expect(continueList('plain', 5)).toBeNull();
  });

  it('inserts a link around the selection', () => {
    expect(insertLink('see sheet now', 4, 9, '', 'https://x.org').value).toBe('see [sheet](https://x.org) now');
  });

  it('spots a 1/N sequence start', () => {
    expect(findSequenceStart('Intro\n1/3 Titration practical')).toEqual({ total: 3, rest: 'Titration practical', line: '1/3 Titration practical' });
    expect(findSequenceStart('2/3 Titration')).toBeNull();
    expect(findSequenceStart('1/1 nope')).toBeNull();
  });
});
