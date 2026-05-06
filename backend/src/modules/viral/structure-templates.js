/**
 * Song Structure Templates
 * Predefined viral song structures for desi hip-hop
 */

export const STRUCTURE_TEMPLATES = {
  'hook-first': {
    id: 'hook-first',
    name: 'Hook-First (Viral)',
    description: 'Start with the hook to immediately grab attention. Best for trending sounds and TikTok.',
    structure: ['Hook', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Hook', 'Outro'],
    sections: {
      Hook: { position: 0, duration: '8-16 bars', energy: 'high' },
      Verse: { position: 1, duration: '16 bars', energy: 'medium' },
      Chorus: { position: 2, duration: '8 bars', energy: 'high' },
      Verse: { position: 3, duration: '16 bars', energy: 'medium' },
      Chorus: { position: 4, duration: '8 bars', energy: 'high' },
      Hook: { position: 5, duration: '8 bars', energy: 'high' },
      Outro: { position: 6, duration: '4 bars', energy: 'low' },
    },
    tags: ['TikTok viral', 'trending sounds', 'challenge videos'],
    recommendedFor: ['trap', 'drill', 'pop rap'],
  },

  'build-up': {
    id: 'build-up',
    name: 'Build-Up (Festival)',
    description: 'Gradual intensity increase for maximum impact. Great for club tracks and anthems.',
    structure: ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Drop', 'Verse', 'Chorus', 'Outro'],
    sections: {
      Intro: { position: 0, duration: '4-8 bars', energy: 'low' },
      Verse: { position: 1, duration: '16 bars', energy: 'medium' },
      'Pre-Chorus': { position: 2, duration: '4 bars', energy: 'building' },
      Chorus: { position: 3, duration: '8 bars', energy: 'high' },
      Drop: { position: 4, duration: '8 bars', energy: 'peak' },
      Verse: { position: 5, duration: '16 bars', energy: 'medium' },
      Chorus: { position: 6, duration: '8 bars', energy: 'high' },
      Outro: { position: 7, duration: '4 bars', energy: 'low' },
    },
    tags: ['club tracks', 'festival drops', 'anthems'],
    recommendedFor: ['EDM blend', 'big beat', 'bhangra'],
  },

  'traditional': {
    id: 'traditional',
    name: 'Traditional (Storytelling)',
    description: 'Classic verse-chorus structure for narrative flow. Best for meaningful lyrics.',
    structure: ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Bridge', 'Chorus', 'Outro'],
    sections: {
      Intro: { position: 0, duration: '4 bars', energy: 'low' },
      Verse: { position: 1, duration: '16 bars', energy: 'medium' },
      Chorus: { position: 2, duration: '8 bars', energy: 'high' },
      Verse: { position: 3, duration: '16 bars', energy: 'medium' },
      Chorus: { position: 4, duration: '8 bars', energy: 'high' },
      Bridge: { position: 5, duration: '8 bars', energy: 'different' },
      Chorus: { position: 6, duration: '8 bars', energy: 'high' },
      Outro: { position: 7, duration: '4 bars', energy: 'low' },
    },
    tags: ['conscious rap', 'story songs', 'album tracks'],
    recommendedFor: ['lyrical rap', 'desi conscious', 'ghazal fusion'],
  },

  'drill': {
    id: 'drill',
    name: 'Drill (Street)',
    description: 'Fast-paced drill style with repeated hooks. Maximum energy throughout.',
    structure: ['Intro', 'Hook', 'Verse', 'Hook', 'Verse', 'Hook', 'Outro'],
    sections: {
      Intro: { position: 0, duration: '2-4 bars', energy: 'medium' },
      Hook: { position: 1, duration: '4-8 bars', energy: 'high' },
      Verse: { position: 2, duration: '16 bars', energy: 'high' },
      Hook: { position: 3, duration: '4-8 bars', energy: 'high' },
      Verse: { position: 4, duration: '16 bars', energy: 'high' },
      Hook: { position: 5, duration: '4-8 bars', energy: 'high' },
      Outro: { position: 6, duration: '2-4 bars', energy: 'low' },
    },
    tags: ['street rap', 'drill tracks', 'cyphers'],
    recommendedFor: ['UK drill', 'desi drill', 'street drill'],
  },

  'pop-hit': {
    id: 'pop-hit',
    name: 'Pop Hit (Radio)',
    description: 'Radio-friendly structure with catchy hook and memorable chorus.',
    structure: ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Verse', 'Chorus', 'Bridge', 'Chorus', 'Outro'],
    sections: {
      Intro: { position: 0, duration: '4 bars', energy: 'low' },
      Verse: { position: 1, duration: '8 bars', energy: 'medium' },
      'Pre-Chorus': { position: 2, duration: '4 bars', energy: 'building' },
      Chorus: { position: 3, duration: '8 bars', energy: 'high' },
      Verse: { position: 4, duration: '8 bars', energy: 'medium' },
      Chorus: { position: 5, duration: '8 bars', energy: 'high' },
      Bridge: { position: 6, duration: '4 bars', energy: 'different' },
      Chorus: { position: 7, duration: '8 bars', energy: 'high' },
      Outro: { position: 8, duration: '4 bars', energy: 'low' },
    },
   tags: ['radio play', 'streaming', 'playlists'],
    recommendedFor: ['pop rap', 'melodic rap', 'R&B blend'],
  },

  'freestyle': {
    id: 'freestyle',
    name: 'Freestyle (Cypher)',
    description: 'Loose structure for cyphers and freestyles. Energy-focused.',
    structure: ['Hook', 'Verse', 'Hook', 'Verse', 'Hook'],
    sections: {
      Hook: { position: 0, duration: '4 bars', energy: 'high' },
      Verse: { position: 1, duration: '16-32 bars', energy: 'high' },
      Hook: { position: 2, duration: '4 bars', energy: 'high' },
      Verse: { position: 3, duration: '16-32 bars', energy: 'high' },
      Hook: { position: 4, duration: '4 bars', energy: 'high' },
    },
   tags: ['cyphers', 'freestyles', 'battles'],
    recommendedFor: ['battle rap', 'cyphers', 'spit games'],
  },
};

/**
 * Get all structure templates
 */
export function getAllTemplates() {
  return Object.values(STRUCTURE_TEMPLATES).map(({ sections, ...template }) => ({
    ...template,
    sectionCount: template.structure.length,
  }));
}

/**
 * Get template by ID
 */
export function getTemplateById(id) {
  const template = STRUCTURE_TEMPLATES[id];
  if (!template) return null;
  const { sections, ...rest } = template;
  return {
    ...rest,
    sections: sections,
  };
}

/**
 * Get templates recommended for a genre
 */
export function getTemplatesByGenre(genre) {
  const genreLower = genre.toLowerCase();
  return Object.values(STRUCTURE_TEMPLATES)
    .filter(t => t.recommendedFor.some(g => g.toLowerCase().includes(genreLower)))
    .map(({ sections, ...template }) => ({
      ...template,
      sectionCount: template.structure.length,
    }));
}

/**
 * Get structure visualization
 */
export function getStructureVisualization(templateId) {
  const template = STRUCTURE_TEMPLATES[templateId];
  if (!template) return null;

  return template.structure.map((section, index) => {
    const sectionInfo = template.sections[section];
    return {
      name: section,
      position: index + 1,
      total: template.structure.length,
      duration: sectionInfo?.duration || 'N/A',
      energy: sectionInfo?.energy || 'medium',
      isHook: section === 'Hook' || section === 'Chorus',
    };
  });
}

export default {
  STRUCTURE_TEMPLATES,
  getAllTemplates,
  getTemplateById,
  getTemplatesByGenre,
  getStructureVisualization,
};