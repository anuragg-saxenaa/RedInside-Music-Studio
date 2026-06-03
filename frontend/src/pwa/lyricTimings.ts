export interface LyricLine {
  text: string;
  startTime: number;  // seconds
  endTime: number;    // seconds
  isSection: boolean; // [Verse 1] style headers
}

// Distribute song duration across lyric lines with a realistic model:
//   - 10% of duration reserved as instrumental intro before first lyric
//   - 1.5s inter-section gaps (musical transitions between sections)
//   - Within each section, lines weighted by syllable count
// This produces much better auto-sync than flat distribution, especially for
// structured songs with clear intros and section breaks.
export function computeLyricTimings(text: string, durationSec: number): LyricLine[] {
  if (!text || !durationSec || durationSec <= 0) return [];

  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (!rawLines.length) return [];

  const SECTION_RE = /^\[.+\]$/;

  const countSyllables = (line: string): number =>
    Math.max(1, (line.toLowerCase().match(/[aeiouy]+/g) || []).length);

  // Parse into sections
  type Sec = { header: string | null; lines: string[] };
  const sections: Sec[] = [];
  let cur: Sec = { header: null, lines: [] };

  for (const line of rawLines) {
    if (SECTION_RE.test(line)) {
      if (cur.header !== null || cur.lines.length > 0) sections.push(cur);
      cur = { header: line, lines: [] };
    } else {
      cur.lines.push(line);
    }
  }
  if (cur.header !== null || cur.lines.length > 0) sections.push(cur);
  if (!sections.length) return [];

  // Reserve instrumental intro time (10% of duration, only for structured songs).
  const introTime = sections.length > 1 ? durationSec * 0.10 : 0;
  // 1.5s gap between sections for musical transitions (not after the last).
  const sectionGap = 1.5;
  const totalGaps = Math.max(0, sections.length - 1) * sectionGap;
  // Remaining time for actual sung/spoken content.
  const lyricBudget = Math.max(10, durationSec - introTime - totalGaps);

  // Weight each section by total syllable count.
  const weighted = sections.map(s => ({
    ...s,
    weight: s.lines.reduce((sum, l) => sum + countSyllables(l), 0) + (s.header ? 0.5 : 0),
  }));
  const totalWeight = weighted.reduce((s, w) => s + w.weight, 0) || 1;

  const result: LyricLine[] = [];
  let t = introTime;

  for (let si = 0; si < weighted.length; si++) {
    const sec = weighted[si];
    const secBudget = (sec.weight / totalWeight) * lyricBudget;

    // Section header gets a fixed small slice.
    if (sec.header) {
      const hDur = Math.min(1.5, secBudget * 0.15);
      result.push({ text: sec.header, startTime: t, endTime: t + hDur, isSection: true });
      t += hDur;
    }

    if (sec.lines.length > 0) {
      const linesBudget = sec.header
        ? secBudget - Math.min(1.5, secBudget * 0.15)
        : secBudget;
      const lineWeights = sec.lines.map(countSyllables);
      const totalLineWeight = lineWeights.reduce((s, w) => s + w, 0) || 1;

      for (let li = 0; li < sec.lines.length; li++) {
        const dur = (lineWeights[li] / totalLineWeight) * linesBudget;
        result.push({ text: sec.lines[li], startTime: t, endTime: t + dur, isSection: false });
        t += dur;
      }
    }

    // Gap between sections.
    if (si < weighted.length - 1) t += sectionGap;
  }

  return result;
}
