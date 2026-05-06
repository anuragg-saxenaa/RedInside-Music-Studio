/**
 * Hook Quality Analyzer
 * Analyzes lyrics for hook quality, repetition patterns, and placement
 */

/**
 * Analyze hook quality in lyrics
 * @param {string} lyrics - The lyrics content to analyze
 * @returns {Object} - { score: 0-100, suggestions: [...], details: {...} }
 */
export function analyzeHook(lyrics) {
  if (!lyrics || typeof lyrics !== 'string' || lyrics.trim().length === 0) {
    return {
      score: 0,
      suggestions: ['No lyrics provided for analysis'],
      details: {
        hasHook: false,
        repetitionCount: 0,
        hookPlacement: 'none',
        hookLines: [],
      },
    };
  }

  const lines = lyrics.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const analysis = {
    score: 0,
    suggestions: [],
    details: {
      hasHook: false,
      repetitionCount: 0,
      hookPlacement: 'none',
      hookLines: [],
      lineCount: lines.length,
    },
  };

  // Find potential hook lines (repeated lines, short punchy lines, capitalized lines)
  const hookCandidates = findHookCandidates(lines);
  analysis.details.hookLines = hookCandidates;

  // Calculate actual repetition count (lines that appear 2+ times)
  const allLines = lyrics.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const lineFrequency = {};
  allLines.forEach(line => {
    const normalized = line.toLowerCase().replace(/[^\w\s]/g, '').trim();
    if (normalized.length > 5) {
      lineFrequency[normalized] = (lineFrequency[normalized] || 0) + 1;
    }
  });
  analysis.details.repetitionCount = Object.values(lineFrequency).filter(count => count >= 2).length;
  analysis.details.hasHook = analysis.details.repetitionCount > 0 || hookCandidates.length > 0;

  // Check for repetition patterns
  const repetitionScore = calculateRepetitionScore(lines);
  analysis.score += repetitionScore * 0.4; // 40% weight

  // Check hook placement
  const placementScore = calculatePlacementScore(lines, hookCandidates);
  analysis.score += placementScore * 0.3; // 30% weight

  // Check hook quality (length, punchiness)
  const qualityScore = calculateQualityScore(hookCandidates);
  analysis.score += qualityScore * 0.3; // 30% weight

  // Normalize score to 0-100
  analysis.score = Math.min(100, Math.max(0, Math.round(analysis.score)));

  // Generate suggestions
  analysis.suggestions = generateSuggestions(analysis, lines);

  return analysis;
}

/**
 * Find potential hook lines in lyrics
 */
function findHookCandidates(lines) {
  const lineFrequency = {};
  const hookCandidates = [];

  // Count line occurrences
  lines.forEach(line => {
    const normalized = line.toLowerCase().replace(/[^\w\s]/g, '').trim();
    lineFrequency[normalized] = (lineFrequency[normalized] || 0) + 1;
  });

  // Find repeated lines (potential hooks)
  lines.forEach((line, index) => {
    const normalized = line.toLowerCase().replace(/[^\w\s]/g, '').trim();

    // Repeated 2+ times or short punchy line at start/end
    if (lineFrequency[normalized] >= 2 || (line.length < 50 && isAllCaps(line))) {
      hookCandidates.push({
        line,
        index,
        repetition: lineFrequency[normalized],
        isPunchy: line.length < 50,
        isAllCaps: isAllCaps(line),
      });
    }
  });

  // Dedupe by line content
  const seen = new Set();
  return hookCandidates.filter(c => {
    const key = c.line.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Check if line is in all caps
 */
function isAllCaps(line) {
  const letters = line.replace(/[^a-zA-Z]/g, '');
  return letters.length > 0 && letters === letters.toUpperCase();
}

/**
 * Calculate repetition score (0-100)
 */
function calculateRepetitionScore(lines) {
  if (lines.length === 0) return 0;

  const lineFrequency = {};
  lines.forEach(line => {
    const normalized = line.toLowerCase().replace(/[^\w\s]/g, '').trim();
    if (normalized.length > 5) { // Ignore very short fragments
      lineFrequency[normalized] = (lineFrequency[normalized] || 0) + 1;
    }
  });

  const repeatedLines = Object.values(lineFrequency).filter(count => count >= 2).length;
  const totalUniqueLines = Object.keys(lineFrequency).length;

  if (totalUniqueLines === 0) return 50;

  const repetitionRatio = repeatedLines / totalUniqueLines;

  // Viral hooks typically have 20-40% repetition
  if (repetitionRatio >= 0.2 && repetitionRatio <= 0.5) {
    return 80 + (repetitionRatio * 40);
  } else if (repetitionRatio > 0.5) {
    return 70; // Too much repetition
  } else {
    return Math.max(20, repetitionRatio * 100);
  }
}

/**
 * Calculate hook placement score (0-100)
 * Hooks at the start or end are more viral
 */
function calculatePlacementScore(lines, hookCandidates) {
  if (lines.length === 0 || hookCandidates.length === 0) return 0;

  let score = 50; // Base score

  // Check if hook is in first 25% of song
  const firstQuarterIndex = Math.floor(lines.length * 0.25);
  const hasEarlyHook = hookCandidates.some(c => c.index <= firstQuarterIndex);
  if (hasEarlyHook) score += 25;

  // Check if hook is in last 25% of song
  const lastQuarterIndex = Math.floor(lines.length * 0.75);
  const hasLateHook = hookCandidates.some(c => c.index >= lastQuarterIndex);
  if (hasLateHook) score += 25;

  return Math.min(100, score);
}

/**
 * Calculate hook quality score (0-100)
 */
function calculateQualityScore(hookCandidates) {
  if (hookCandidates.length === 0) return 30;

  let score = 50;

  // Good hooks are punchy (short) and repeated
  hookCandidates.forEach(c => {
    if (c.isPunchy) score += 10;
    if (c.repetition >= 3) score += 15;
    if (c.repetition >= 2) score += 10;
    if (c.isAllCaps) score += 5;
  });

  return Math.min(100, score);
}

/**
 * Generate suggestions for improvement
 */
function generateSuggestions(analysis, lines) {
  const suggestions = [];

  if (!analysis.details.hasHook && analysis.score < 50) {
    suggestions.push('Add a repeated hook phrase to increase catchiness');
  }

  if (analysis.details.repetitionCount < 2) {
    suggestions.push('Consider repeating key hook lines 2-3 times for better memorability');
  }

  if (analysis.details.hookPlacement === 'none') {
    suggestions.push('Place the hook in the first or last quarter of the song for maximum impact');
  }

  if (lines.length < 20) {
    suggestions.push('Song may be too short for optimal hook impact - aim for 30-60 seconds of lyrics');
  }

  // Check for caps usage
  const hasCaps = lines.some(l => isAllCaps(l));
  if (!hasCaps) {
    suggestions.push('Consider using ALL CAPS for emphasis on hook lines');
  }

  if (suggestions.length === 0) {
    suggestions.push('Hook quality is good - maintain current structure');
  }

  return suggestions;
}

export default { analyzeHook };