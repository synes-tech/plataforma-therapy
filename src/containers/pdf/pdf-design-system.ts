/** Tokens visuais Unithery adaptados para impressão (identidade-visual.md). */
export const PDF_COLORS = {
  primary: '#1A86E2',
  primaryDark: '#1565C0',
  charcoal: '#0F172A',
  charcoalMuted: '#475569',
  slate: '#64748B',
  slateLight: '#94A3B8',
  border: '#E2E8F0',
  surface: '#F8FAF9',
  white: '#FFFFFF',
  mint: '#059669',
} as const;

export const PDF_PAGE = {
  paddingTop: 52,
  paddingBottom: 64,
  paddingHorizontal: 48,
  accentHeight: 4,
} as const;

export const PDF_FONTS = {
  body: 'Helvetica',
  bodyBold: 'Helvetica-Bold',
  display: 'Helvetica-Bold',
  mono: 'Courier',
} as const;
