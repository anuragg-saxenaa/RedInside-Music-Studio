import type { CSSProperties } from 'react';

export const C = {
  bg:           '#040102',
  bgApp:        'radial-gradient(ellipse at 10% 0%, rgba(230,57,70,0.40) 0%, transparent 45%), radial-gradient(ellipse at 90% 90%, rgba(180,30,40,0.30) 0%, transparent 45%), radial-gradient(ellipse at 55% 45%, rgba(80,5,10,0.50) 0%, transparent 70%), #040102',
  red:          '#E63946',
  redDark:      '#a01828',
  gold:         '#FFB800',
  glass:        'rgba(0,0,0,0.55)',
  glassActive:  'rgba(230,57,70,0.10)',
  border:       'rgba(230,57,70,0.16)',
  borderActive: 'rgba(230,57,70,0.36)',
  text:         '#fff',
  textDim:      'rgba(255,255,255,0.28)',
  textLabel:    'rgba(230,57,70,0.45)',
};

export const glassStyle: CSSProperties = {
  background: 'rgba(0,0,0,0.55)',
  backdropFilter: 'blur(18px) saturate(1.2)',
  border: '1px solid rgba(230,57,70,0.16)',
  borderRadius: '10px',
};
