export interface LyricLine {
  text: string;
  startTime: number;  // seconds
  endTime: number;    // seconds
  isSection: boolean; // [Verse 1] style headers
}

// Proportionally distribute song duration across lyric lines weighted by
// syllable count. Section headers ([Verse], [Chorus] etc) get 0.5s each.
// This produces rough-but-reasonable auto-sync without any LRC data.
export function computeLyricTimings(text: string, durationSec: number): LyricLine[] {
  if (!text || !durationSec || durationSec <= 0) return [];

  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return [];

  const SECTION_RE = /^\[.+\]$/;

  const countSyllables = (line: string): number => {
    const m = line.toLowerCase().match(/[aeiouy]+/g);
    return Math.max(1, m?.length ?? 1);
  };

  const annotated = rawLines.map(line => ({
    text: line,
    isSection: SECTION_RE.test(line),
    weight: SECTION_RE.test(line) ? 0.5 : countSyllables(line),
  }));

  const totalWeight = annotated.reduce((s, l) => s + l.weight, 0);
  if (totalWeight === 0) return [];

  const timePerUnit = durationSec / totalWeight;
  let t = 0;

  return annotated.map(l => {
    const dur = l.weight * timePerUnit;
    const line: LyricLine = { text: l.text, startTime: t, endTime: t + dur, isSection: l.isSection };
    t += dur;
    return line;
  });
}
