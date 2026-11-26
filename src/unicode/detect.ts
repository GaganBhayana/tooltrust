import type { Finding, Severity } from '../model.ts';

/** The kinds of Unicode trickery the detector reports. */
export type UnicodeTrick = 'zero-width' | 'tag-characters' | 'bidi-control' | 'mixed-script';

/** One run of suspicious characters, or one mixed-script word. */
export interface UnicodeHit {
  readonly kind: UnicodeTrick;
  /** Start of the run as a UTF-16 index into the text (what `String.prototype.slice` uses). */
  readonly offset: number;
  /** Length of the run in UTF-16 code units. */
  readonly length: number;
  /** 1-based line of the run's start. Lines end at `\n`, `\r\n` or `\r`. */
  readonly line: number;
  /** 1-based column of the run's start, counted in code points from the line start. */
  readonly column: number;
  /** The suspicious code points as `U+XXXX`, in order (for mixed-script: the non-Latin letters). */
  readonly codePoints: readonly string[];
  /** For `tag-characters`: the hidden ASCII text the tags spell. */
  readonly decoded?: string;
  /** For `mixed-script`: the word, with look-alike letters shown as `<U+XXXX>`. */
  readonly word?: string;
}

/** Rule ids used in findings, one per {@link UnicodeTrick}. */
export const UNICODE_RULES: Readonly<Record<UnicodeTrick, { readonly id: string; readonly rationale: string }>> = {
  'zero-width': {
    id: 'unicode.zero-width',
    rationale: 'Invisible characters can hide or split words so that text reads differently to people and models.',
  },
  'tag-characters': {
    id: 'unicode.tag-characters',
    rationale: 'Unicode tag characters are invisible but spell ASCII text that models can read: a known way to hide instructions.',
  },
  'bidi-control': {
    id: 'unicode.bidi-control',
    rationale: 'Bidirectional overrides and isolates reorder how text is shown, so what people see differs from what is there.',
  },
  'mixed-script': {
    id: 'unicode.mixed-script',
    rationale: 'A word mixing Latin with look-alike Cyrillic, Greek or Armenian letters can impersonate another name.',
  },
};

const ZERO_WIDTH = new Set([0x180e, 0x200b, 0x200c, 0x200d, 0x2060, 0x2061, 0x2062, 0x2063, 0x2064, 0xfeff, 0x034f]);
const ZWNJ = 0x200c;
const ZWJ = 0x200d;
const BOM = 0xfeff;
const TAG_FIRST = 0xe0000;
const TAG_LAST = 0xe007f;
const CANCEL_TAG = 0xe007f;
const BLACK_FLAG = 0x1f3f4;
const isBidi = (cp: number): boolean => (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069);
const isTag = (cp: number): boolean => cp >= TAG_FIRST && cp <= TAG_LAST;

/** Scripts that use ZWNJ and ZWJ in normal writing, so joiners between their letters are fine. */
const JOINING_SCRIPT =
  /[\p{Script=Arabic}\p{Script=Syriac}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}]/u;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;

/**
 * Non-Latin letters that look like Latin ones. A word with Latin letters and any of these is
 * reported; other non-Latin letters (for example Greek mu in `5 \u03BCs`) are left alone.
 */
const CONFUSABLES = new Set(
  Array.from(
    // Cyrillic
    '\u0430\u0410\u0412\u0441\u0421\u0435\u0415\u04BB\u04BA\u0456\u0406\u0458\u0408\u043A\u041A\u041C\u041D\u043E\u041E\u0440\u0420\u0455\u0405\u0422\u0443\u0423\u0445\u0425\u0501\u051B\u051D\u0461\u04CF\u04AF' +
      // Greek
      '\u03B1\u0391\u0392\u0395\u0396\u0397\u03B9\u0399\u03BA\u039A\u039C\u03BD\u039D\u03BF\u039F\u03C1\u03A1\u03A4\u03C5\u03A5\u03C7\u03A7' +
      // Armenian
      '\u0585\u057D\u0578\u0570\u0581\u0566',
  ),
);
const WORD = /[\p{L}\p{M}\p{N}_$-]+/gu;
const LATIN = /\p{Script=Latin}/u;

/**
 * Finds hidden or misleading Unicode in `text`: zero-width characters, tag characters
 * (with their hidden ASCII decoded), bidi overrides and isolates, and words that mix Latin
 * with look-alike letters. Runs of the same kind are reported once. Hits are sorted by offset.
 *
 * Normal uses are not reported: a byte-order mark at offset 0, ZWJ inside emoji sequences,
 * ZWNJ or ZWJ between letters of scripts that need them, and the tag sequences of emoji
 * subdivision flags (such as the flag of Scotland).
 */
export function detectUnicode(text: string): UnicodeHit[] {
  const positions = new Positions(text);
  const hits = [...invisibleRuns(text, positions), ...mixedScriptWords(text, positions)];
  return hits.sort((a, b) => a.offset - b.offset);
}

/** Decodes the ASCII text spelled by Unicode tag characters; other characters are skipped. */
export function decodeTags(text: string): string {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= TAG_FIRST + 0x20 && cp <= TAG_FIRST + 0x7e) out += String.fromCodePoint(cp - TAG_FIRST);
  }
  return out;
}

/** Runs {@link detectUnicode} and turns each hit into a {@link Finding} for the given path. */
export function unicodeFindings(text: string, path?: string): Finding[] {
  return detectUnicode(text).map((hit) => ({
    ruleId: UNICODE_RULES[hit.kind].id,
    severity: severityOf(hit),
    message: messageOf(hit),
    evidence: {
      ...(path === undefined ? {} : { path }),
      excerpt: excerpt(text, hit),
      offset: hit.offset,
      line: hit.line,
    },
  }));
}

/** Shows a string with every zero-width, tag and bidi control character spelled out as `<U+XXXX>`. */
export function revealInvisible(text: string): string {
  return reveal(text, (ch, cp) => ZERO_WIDTH.has(cp) || isBidi(cp) || isTag(cp));
}

function reveal(text: string, shouldReveal: (ch: string, cp: number) => boolean): string {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    out += shouldReveal(ch, cp) ? `<${hex(cp)}>` : ch;
  }
  return out;
}

interface CodePoint {
  readonly cp: number;
  readonly ch: string;
  readonly index: number;
}

function* codePoints(text: string): Generator<CodePoint> {
  let index = 0;
  for (const ch of text) {
    yield { cp: ch.codePointAt(0) ?? 0, ch, index };
    index += ch.length;
  }
}

type InvisibleKind = 'zero-width' | 'tag-characters' | 'bidi-control';

function invisibleKind(cp: number): InvisibleKind | undefined {
  if (ZERO_WIDTH.has(cp)) return 'zero-width';
  if (isTag(cp)) return 'tag-characters';
  if (isBidi(cp)) return 'bidi-control';
  return undefined;
}

function invisibleRuns(text: string, positions: Positions): UnicodeHit[] {
  const all = [...codePoints(text)];
  const hits: UnicodeHit[] = [];
  let i = 0;
  while (i < all.length) {
    const first = all[i] as CodePoint;
    const kind = invisibleKind(first.cp);
    if (kind === undefined || isBenignSingle(all, i)) {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < all.length && invisibleKind((all[j] as CodePoint).cp) === kind && !isBenignSingle(all, j)) j += 1;
    const run = all.slice(i, j);
    const prev = all[i - 1];
    i = j;
    if (kind === 'tag-characters' && prev?.cp === BLACK_FLAG && isFlagTagSequence(run)) continue;
    const end = (run[run.length - 1] as CodePoint).index + (run[run.length - 1] as CodePoint).ch.length;
    const hit: UnicodeHit = {
      kind,
      offset: first.index,
      length: end - first.index,
      ...positions.of(first.index),
      codePoints: run.map((c) => hex(c.cp)),
      ...(kind === 'tag-characters' ? { decoded: decodeTags(text.slice(first.index, end)) } : {}),
    };
    hits.push(hit);
  }
  return hits;
}

/** True for zero-width characters with a normal job at this position. */
function isBenignSingle(all: readonly CodePoint[], i: number): boolean {
  const here = all[i] as CodePoint;
  if (here.cp === BOM && i === 0) return true;
  if (here.cp !== ZWJ && here.cp !== ZWNJ) return false;
  const before = all[i - 1]?.ch ?? '';
  const after = all[i + 1]?.ch ?? '';
  if (here.cp === ZWJ && PICTOGRAPHIC.test(before) && PICTOGRAPHIC.test(after)) return true;
  // Emoji with a variation selector or skin tone before the joiner, as in the rainbow flag.
  if (here.cp === ZWJ && PICTOGRAPHIC.test(after) && /[\uFE0F\u{1F3FB}-\u{1F3FF}]/u.test(before)) return true;
  return JOINING_SCRIPT.test(before) && JOINING_SCRIPT.test(after);
}

/** An emoji subdivision flag: 2 to 6 lowercase letters or digits in tags, then a cancel tag. */
function isFlagTagSequence(run: readonly CodePoint[]): boolean {
  const last = run[run.length - 1];
  if (last?.cp !== CANCEL_TAG || run.length < 3 || run.length > 7) return false;
  return run.slice(0, -1).every((c) => (c.cp >= 0xe0030 && c.cp <= 0xe0039) || (c.cp >= 0xe0061 && c.cp <= 0xe007a));
}

function mixedScriptWords(text: string, positions: Positions): UnicodeHit[] {
  const hits: UnicodeHit[] = [];
  for (const match of text.matchAll(WORD)) {
    const word = match[0];
    const letters = Array.from(word);
    const lookalikes = letters.filter((ch) => CONFUSABLES.has(ch));
    if (lookalikes.length === 0 || !letters.some((ch) => LATIN.test(ch))) continue;
    hits.push({
      kind: 'mixed-script',
      offset: match.index,
      length: word.length,
      ...positions.of(match.index),
      codePoints: lookalikes.map((ch) => hex(ch.codePointAt(0) ?? 0)),
      word: reveal(word, (ch, cp) => CONFUSABLES.has(ch) || invisibleKind(cp) !== undefined),
    });
  }
  return hits;
}

function severityOf(hit: UnicodeHit): Severity {
  switch (hit.kind) {
    case 'tag-characters':
      return (hit.decoded ?? '').trim() === '' ? 'high' : 'critical';
    case 'bidi-control':
      return 'high';
    case 'zero-width':
    case 'mixed-script':
      return 'medium';
  }
}

function messageOf(hit: UnicodeHit): string {
  const where = `at line ${hit.line}, column ${hit.column}`;
  switch (hit.kind) {
    case 'tag-characters':
      return `${hit.codePoints.length} invisible tag characters ${where} spell: ${JSON.stringify(hit.decoded ?? '')}`;
    case 'bidi-control':
      return `Bidirectional control characters ${hit.codePoints.join(' ')} ${where}`;
    case 'zero-width':
      return `Zero-width characters ${hit.codePoints.join(' ')} ${where}`;
    case 'mixed-script':
      return `Word ${JSON.stringify(hit.word ?? '')} ${where} mixes Latin with look-alike letters ${hit.codePoints.join(' ')}`;
  }
}

const CONTEXT = 20;

/** The hit with up to 20 characters either side, invisible characters spelled out. */
function excerpt(text: string, hit: UnicodeHit): string {
  const start = safeIndex(text, Math.max(0, hit.offset - CONTEXT));
  const end = safeIndex(text, Math.min(text.length, hit.offset + hit.length + CONTEXT));
  return revealInvisible(text.slice(start, end)).replace(/\r\n?|\n/g, ' ');
}

/** Moves an index off the low half of a surrogate pair so slicing never splits one. */
function safeIndex(text: string, index: number): number {
  const code = text.charCodeAt(index);
  return code >= 0xdc00 && code <= 0xdfff && index > 0 ? index - 1 : index;
}

function isSurrogatePair(text: string, index: number): boolean {
  const high = text.charCodeAt(index);
  const low = text.charCodeAt(index + 1);
  return high >= 0xd800 && high <= 0xdbff && low >= 0xdc00 && low <= 0xdfff;
}

function hex(cp: number): string {
  return `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
}

/**
 * Maps UTF-16 offsets to 1-based lines and code-point columns. Columns are counted on from
 * the previous lookup when it was earlier on the same line, so lookups in increasing
 * offset order cost linear time overall, even on one very long line.
 */
class Positions {
  readonly #text: string;
  readonly #lineStarts: number[] = [0];
  #last = { offset: 0, line: 0, column: 1 };

  constructor(text: string) {
    this.#text = text;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code === 0x0a || (code === 0x0d && text.charCodeAt(i + 1) !== 0x0a)) this.#lineStarts.push(i + 1);
    }
  }

  of(offset: number): { line: number; column: number } {
    const line = this.#lineIndex(offset);
    const resume = this.#last.line === line && this.#last.offset <= offset;
    let index = resume ? this.#last.offset : (this.#lineStarts[line] ?? 0);
    let column = resume ? this.#last.column : 1;
    while (index < offset) {
      index += isSurrogatePair(this.#text, index) ? 2 : 1;
      column += 1;
    }
    this.#last = { offset, line, column };
    return { line: line + 1, column };
  }

  #lineIndex(offset: number): number {
    let low = 0;
    let high = this.#lineStarts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if ((this.#lineStarts[mid] ?? 0) <= offset) low = mid;
      else high = mid - 1;
    }
    return low;
  }
}
