export const STYLE_PRESETS = {
  'hinglish-urban': {
    name: 'Hinglish Urban',
    description: 'Hindi-English mix, modern trap/drill beats, urban Indian sound',
    promptTemplate: 'Modern urban Hinglish hip-hop with trap/drill influence, mixing Hindi and English, street style, catchy hooks,',
    languages: ['Hindi', 'English'],
    mood: 'confident, energetic, rebellious',
  },
  'hindi-urdu-classical': {
    name: 'Hindi-Urdu Classical',
    description: 'Ghazal-inspired, poetic, soulful',
    promptTemplate: 'Soulful Hindi-Urdu hip-hop with ghazal inspiration, poetic and emotional, deep lyrics, husky vocals,',
    languages: ['Hindi', 'Urdu'],
    mood: 'emotional, romantic, melancholic',
  },
  'punjabi-swagger': {
    name: 'Punjabi Swagger',
    description: 'Bhangra influence, Sidhu Moose Wala style',
    promptTemplate: 'Punjabi hip-hop with bhangra beats, swagger and confidence, Sidhu Moose Wala style, bold lyrics,',
    languages: ['Punjabi', 'English'],
    mood: 'bold, proud, energetic',
  },
  'regional-fusion': {
    name: 'Regional Fusion',
    description: 'Multi-language (Tamil, Telugu, Bengali + English)',
    promptTemplate: 'Regional Indian hip-hop fusion with Tamil/Telugu/Bengali influence, mixing local language with English, diverse cultural elements,',
    languages: ['Tamil', 'Telugu', 'Bengali', 'English'],
    mood: 'diverse, cultural, fusion',
  },
  'custom': {
    name: 'Custom',
    description: 'User-defined prompt',
    promptTemplate: '',
    languages: [],
    mood: '',
  },
};

export function getPreset(presetName) {
  return STYLE_PRESETS[presetName] || STYLE_PRESETS['custom'];
}

export function buildPrompt(presetName, userPrompt) {
  const preset = getPreset(presetName);
  if (presetName === 'custom') {
    return userPrompt;
  }
  return `${preset.promptTemplate} ${userPrompt}`;
}
