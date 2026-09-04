type Range = { start: number; end: number };

type TextMatch = { score: number; ranges: Range[] };

const EXACT = 100;
const PREFIX = 80;
const BOUNDARY = 60;
const CONTAINS = 40;
const SUBSEQUENCE = 20;

/**
 * Capped so a late hit in one tier can never outrank an early hit in the tier
 * above it: the tiers sit 20 apart and the penalty tops out below that.
 */
const MAX_PENALTY = 15;

const KEYWORD_WEIGHT = 0.5;

const SEPARATOR = /[^\p{L}\p{N}]/u;

const isUpper = (character: string): boolean =>
   character !== character.toLowerCase();

const isLower = (character: string): boolean =>
   character !== character.toUpperCase();

const isBoundary = (text: string, index: number): boolean => {
   if (index <= 0) return index === 0;
   const previous = text[index - 1] ?? "";
   const current = text[index] ?? "";
   return SEPARATOR.test(previous) || (isLower(previous) && isUpper(current));
};

const boundaryIndexOf = (
   haystack: string,
   needle: string,
   original: string
): number => {
   for (
      let index = haystack.indexOf(needle);
      index >= 0;
      index = haystack.indexOf(needle, index + 1)
   ) {
      if (isBoundary(original, index)) return index;
   }
   return -1;
};

const penalty = (distance: number): number =>
   Math.min(Math.max(distance, 0), MAX_PENALTY);

const subsequenceRanges = (
   haystack: string,
   needle: string
): Range[] | null => {
   const ranges: Range[] = [];
   let cursor = 0;
   for (const character of needle) {
      const found = haystack.indexOf(character, cursor);
      if (found < 0) return null;
      const last = ranges.at(-1);
      if (last && last.end === found) last.end = found + character.length;
      else ranges.push({ start: found, end: found + character.length });
      cursor = found + character.length;
   }
   return ranges;
};

const matchSubstring = (text: string, term: string): TextMatch | null => {
   const haystack = text.toLowerCase();
   const needle = term.toLowerCase();
   if (!needle) return null;

   if (haystack === needle)
      return { score: EXACT, ranges: [{ start: 0, end: text.length }] };

   if (haystack.startsWith(needle))
      return { score: PREFIX, ranges: [{ start: 0, end: needle.length }] };

   const contains = haystack.indexOf(needle);
   if (contains < 0) return null;
   const boundary = boundaryIndexOf(haystack, needle, text);
   const index = boundary >= 0 ? boundary : contains;
   return {
      score: (boundary >= 0 ? BOUNDARY : CONTAINS) - penalty(index),
      ranges: [{ start: index, end: index + needle.length }],
   };
};

const matchText = (text: string, term: string): TextMatch | null => {
   const substring = matchSubstring(text, term);
   if (substring) return substring;

   const ranges = subsequenceRanges(text.toLowerCase(), term.toLowerCase());
   if (!ranges || ranges.length === 0) return null;
   const spread = (ranges.at(-1)?.end ?? 0) - (ranges[0]?.start ?? 0);
   return { score: SUBSEQUENCE - penalty(spread - term.length), ranges };
};

const mergeRanges = (ranges: Range[]): Range[] => {
   const sorted = [...ranges].sort((a, b) => a.start - b.start);
   const merged: Range[] = [];
   for (const range of sorted) {
      const last = merged.at(-1);
      if (last && range.start <= last.end)
         last.end = Math.max(last.end, range.end);
      else merged.push({ ...range });
   }
   return merged;
};

const splitTerms = (query: string): string[] =>
   query.trim().split(/\s+/).filter(Boolean);

/**
 * Every term has to land somewhere — on the label or on the hidden keywords —
 * so "buck prod" narrows rather than widens. The score is the average across
 * terms, which keeps a two-word query on the same scale as a one-word one.
 *
 * Only the label is matched loosely. Keywords are a long run-on string, and a
 * four-letter subsequence can be found in almost any of them, so a scattered
 * hit there means nothing.
 */
const matchFields = (
   label: string,
   keywords: string,
   terms: readonly string[]
): TextMatch | null => {
   if (terms.length === 0) return { score: 0, ranges: [] };

   let total = 0;
   const ranges: Range[] = [];

   for (const term of terms) {
      const onLabel = matchText(label, term);
      const onKeywords = keywords ? matchSubstring(keywords, term) : null;
      const keywordScore = (onKeywords?.score ?? 0) * KEYWORD_WEIGHT;
      if (!onLabel && !onKeywords) return null;
      if (onLabel && onLabel.score >= keywordScore) {
         total += onLabel.score;
         ranges.push(...onLabel.ranges);
      } else {
         total += keywordScore;
      }
   }

   return { score: total / terms.length, ranges: mergeRanges(ranges) };
};

type Segment = { text: string; matched: boolean };

/** Splits a label into alternating plain and matched runs, for highlighting. */
const segmentText = (text: string, ranges: readonly Range[]): Segment[] => {
   const segments: Segment[] = [];
   let cursor = 0;
   for (const { start, end } of ranges) {
      const from = Math.max(cursor, Math.min(start, text.length));
      const to = Math.max(from, Math.min(end, text.length));
      if (from > cursor)
         segments.push({ text: text.slice(cursor, from), matched: false });
      if (to > from)
         segments.push({ text: text.slice(from, to), matched: true });
      cursor = to;
   }
   if (cursor < text.length)
      segments.push({ text: text.slice(cursor), matched: false });
   return segments;
};

export {
   matchFields,
   matchSubstring,
   matchText,
   mergeRanges,
   segmentText,
   splitTerms,
};
export type { Range, Segment, TextMatch };
