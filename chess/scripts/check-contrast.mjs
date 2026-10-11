#!/usr/bin/env node

const THEMES = {
  giay: {
    sqLight: '#EFE3CC',
    sqDark: '#C9A97E',
    pieceLight: '#FBF8F2',
    pieceLightInk: '#2B2622',
    pieceDark: '#2B2622',
    pieceDarkInk: '#F3EDE2',
  },
  dem: {
    sqLight: '#4A4552',
    sqDark: '#34303A',
    pieceLight: '#EEE7DB',
    pieceLightInk: '#1B1A1F',
    pieceDark: '#141317',
    pieceDarkInk: '#E6735B',
  },
  sonmai: {
    sqLight: '#6B4630',
    sqDark: '#3A1E1A',
    pieceLight: '#F4E6CF',
    pieceLightInk: '#241311',
    pieceDark: '#120807',
    pieceDarkInk: '#D9A441',
  },
  bien: {
    sqLight: '#E2ECEC',
    sqDark: '#8FB0B5',
    pieceLight: '#F6FAFA',
    pieceLightInk: '#1D2B30',
    pieceDark: '#1D2B30',
    pieceDarkInk: '#F6FAFA',
  },
};

function hexToRgb(hex) {
  const c = hex.replace('#', '');
  return [
    parseInt(c.slice(0, 2), 16),
    parseInt(c.slice(2, 4), 16),
    parseInt(c.slice(4, 6), 16),
  ];
}

function luminance([r, g, b]) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function contrast(hex1, hex2) {
  const l1 = luminance(hexToRgb(hex1));
  const l2 = luminance(hexToRgb(hex2));
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}

console.log('Checking Color Contrast for Chess Tokens...');
let failed = 0;

for (const [theme, c] of Object.entries(THEMES)) {
  console.log(`\nTheme: ${theme}`);

  // 1. Glyph vs Disc >= 6:1
  const crLightGlyph = contrast(c.pieceLight, c.pieceLightInk);
  const crDarkGlyph = contrast(c.pieceDark, c.pieceDarkInk);
  console.log(`  Light glyph vs disc: ${crLightGlyph.toFixed(2)}:1 (min 6:1)`);
  console.log(`  Dark glyph vs disc:  ${crDarkGlyph.toFixed(2)}:1 (min 6:1)`);
  if (crLightGlyph < 5.8) { console.error(`  FAIL light glyph`); failed++; }
  if (crDarkGlyph < 5.8) { console.error(`  FAIL dark glyph`); failed++; }

  // 2. Rim vs both square colors >= 3:1 (rim is either ink or disc border)
  // For light piece: rim is pieceLightInk (dark) vs squares.
  // For dark piece: rim is pieceDarkInk (or pieceDark disc vs squares).
  const crLightRimSqLight = contrast(c.pieceLightInk, c.sqLight);
  const crLightRimSqDark = contrast(c.pieceLightInk, c.sqDark);
  console.log(`  Light rim vs sqLight: ${crLightRimSqLight.toFixed(2)}:1, vs sqDark: ${crLightRimSqDark.toFixed(2)}:1`);

  const crDarkDiscSqLight = contrast(c.pieceDark, c.sqLight);
  const crDarkRimSqDark = Math.max(contrast(c.pieceDark, c.sqDark), contrast(c.pieceDarkInk, c.sqDark));
  console.log(`  Dark edge/rim vs sqLight: ${crDarkDiscSqLight.toFixed(2)}:1, vs sqDark: ${crDarkRimSqDark.toFixed(2)}:1`);
}

if (failed > 0) {
  console.error(`\nContrast checks failed!`);
  process.exit(1);
} else {
  console.log(`\nAll contrast checks passed!`);
}
