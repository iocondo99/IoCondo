import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  animationDurations,
  breakpointFor,
  breakpoints,
  colors,
  durations,
  focusRingSize,
  iconSizes,
  layout,
  radii,
  shadows,
  space,
  touchTarget,
  typography,
} from './tokens.ts';

test('colori brand, superfici e testo', () => {
  assert.equal(colors.brand.navy, '#0D3B66');
  assert.equal(colors.brand.blue, '#0EA5E9');
  assert.equal(colors.brand.teal, '#14B8A6');
  assert.equal(colors.background, '#F8FAFC');
  assert.equal(colors.surface, '#FFFFFF');
  assert.equal(colors.border, '#E5E7EB');
  assert.equal(colors.text.primary, '#0F172A');
  assert.equal(colors.text.secondary, '#475569');
  assert.equal(colors.text.muted, '#64748B');
  assert.equal(colors.text.disabled, '#CBD5E1');
  assert.equal(colors.focus, '#0284C7');
});

// Contrasto WCAG 2.x tra due colori esadecimali.
function contrast(a: string, b: string): number {
  const luminance = (hex: string): number => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

test('token action: valori, contrasto WCAG AA e stati più scuri', () => {
  const { action } = colors;
  assert.equal(action.default, '#0A79AB');
  assert.equal(action.hover, '#096C99');
  assert.equal(action.pressed, '#085F86');
  // Testo bianco sullo sfondo action, e testo action sullo sfondo della pagina.
  for (const value of Object.values(action)) {
    assert.ok(contrast(colors.surface, value) >= 4.5, `${value} su bianco`);
  }
  assert.ok(contrast(action.default, colors.background) >= 4.6);
  // Hover e pressed sono via via più scuri, cioè con contrasto crescente sul bianco.
  assert.ok(contrast(colors.surface, action.hover) > contrast(colors.surface, action.default));
  assert.ok(contrast(colors.surface, action.pressed) > contrast(colors.surface, action.hover));
});

test('il blu e il turchese del brand non reggono testo bianco piccolo (restano per accenti)', () => {
  assert.ok(contrast(colors.surface, colors.brand.blue) < 4.5);
  assert.ok(contrast(colors.surface, colors.brand.teal) < 4.5);
});

test('colori semantici con relativi sfondi', () => {
  assert.deepEqual(colors.semantic.success, { foreground: '#15803D', background: '#F0FDF4' });
  assert.deepEqual(colors.semantic.warning, { foreground: '#B45309', background: '#FFFBEB' });
  assert.deepEqual(colors.semantic.error, { foreground: '#B91C1C', background: '#FEF2F2' });
  assert.deepEqual(colors.semantic.info, { foreground: '#0369A1', background: '#F0F9FF' });
});

test('ogni colore è un esadecimale valido', () => {
  const hex = /^#[0-9A-F]{6}$/;
  const walk = (node: unknown): void => {
    if (typeof node === 'string') assert.match(node, hex);
    else for (const value of Object.values(node as object)) walk(value);
  };
  walk(colors);
});

test('spaziature: scala da 4 px', () => {
  assert.deepEqual(space, { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 });
  for (const value of Object.values(space)) assert.equal(value % 4, 0);
});

test('raggi degli angoli', () => {
  assert.equal(radii.control, 8);
  assert.equal(radii.card, 12);
  assert.equal(radii.modal, 16);
  assert.equal(radii.badge, 6);
});

test('tipografia: font e dimensioni della sezione 3', () => {
  const { variants, fontFamily } = typography;
  assert.equal(fontFamily.regular, 'Inter_400Regular');
  assert.deepEqual(variants.h1.fontSize, { compact: 28, regular: 32 });
  assert.deepEqual(variants.h2.fontSize, { compact: 22, regular: 24 });
  assert.deepEqual(variants.h3.fontSize, { compact: 18, regular: 20 });
  assert.deepEqual(variants.h4.fontSize, { compact: 16, regular: 18 });
  assert.deepEqual(variants.body.fontSize, { compact: 16, regular: 16 });
  assert.deepEqual(variants.secondary.fontSize, { compact: 14, regular: 15 });
  assert.deepEqual(variants.label.fontSize, { compact: 14, regular: 14 });
  assert.deepEqual(variants.button.fontSize, { compact: 15, regular: 16 });
  assert.equal(variants.body.lineHeightRatio, 1.5);
  assert.equal(variants.button.weight, 'semibold');
});

test('tipografia: nessun testo sotto 14 px', () => {
  for (const variant of Object.values(typography.variants)) {
    assert.ok(variant.fontSize.compact >= 14);
    assert.ok(variant.fontSize.regular >= variant.fontSize.compact);
  }
});

test('aree di tocco, layout e icone', () => {
  assert.deepEqual(touchTarget, { minimum: 24, control: 44, comfortable: 48 });
  assert.deepEqual(layout, { sidebarWidth: 240, headerHeight: 72 });
  assert.equal(iconSizes.indicator, 16);
  assert.ok(iconSizes.action >= 18 && iconSizes.action <= 20);
  assert.ok(iconSizes.menu >= 20 && iconSizes.menu <= 22);
  assert.ok(iconSizes.card >= 22 && iconSizes.card <= 28);
  assert.deepEqual(focusRingSize, { width: 2, offset: 2 });
});

test('ombre leggere: opacità bassa', () => {
  for (const shadow of Object.values(shadows)) assert.ok(shadow.opacity <= 0.2);
});

test('breakpoint: mobile <768, tablet 768-1199, desktop >=1200', () => {
  assert.deepEqual(breakpoints, { tablet: 768, desktop: 1200 });
  assert.equal(breakpointFor(390), 'mobile');
  assert.equal(breakpointFor(767), 'mobile');
  assert.equal(breakpointFor(768), 'tablet');
  assert.equal(breakpointFor(1199), 'tablet');
  assert.equal(breakpointFor(1200), 'desktop');
  assert.equal(breakpointFor(1440), 'desktop');
});

test('durate delle animazioni: 120-200 ms, 0 se ridotte', () => {
  for (const value of Object.values(durations)) assert.ok(value >= 120 && value <= 200);
  assert.deepEqual(animationDurations(false), durations);
  assert.deepEqual(animationDurations(true), { fast: 0, normal: 0, slow: 0 });
});

test('nessun colore scritto a mano fuori da tokens.ts', () => {
  const srcDir = dirname(fileURLToPath(import.meta.url));
  const files = readdirSync(srcDir, { recursive: true, encoding: 'utf8' }).filter(
    (file) => /\.tsx?$/.test(file) && file !== 'tokens.ts' && !file.endsWith('.test.ts'),
  );
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = readFileSync(join(srcDir, file), 'utf8');
    assert.doesNotMatch(source, /#[0-9A-Fa-f]{3,8}\b/, `${file} contiene un colore esadecimale`);
    assert.doesNotMatch(source, /\brgba?\(/, `${file} contiene un colore rgb`);
  }
});
