(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StormBrandEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_INK = '#1E1D1E';
  const DEFAULT_CANVAS = '#F7F7F5';
  const ACCENT_CONTRAST_MIN = 1.8;
  const CHROMA_MIN = 0.035;

  function normalizeHex(value, fallback = DEFAULT_INK) {
    const raw = String(value || '').trim().toUpperCase();
    return /^#[0-9A-F]{6}$/.test(raw) ? raw : fallback;
  }

  function hexToRgb(hex) {
    const h = normalizeHex(hex).slice(1);
    return {
      r: parseInt(h.slice(0, 2), 16) / 255,
      g: parseInt(h.slice(2, 4), 16) / 255,
      b: parseInt(h.slice(4, 6), 16) / 255
    };
  }

  function srgbToLinear(v) {
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  function relativeLuminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }

  function contrastRatio(a, b) {
    const l1 = relativeLuminance(a);
    const l2 = relativeLuminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  function toOklch(hex) {
    const { r, g, b } = hexToRgb(hex);
    const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);

    const l = 0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B;
    const m = 0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B;
    const s = 0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B;

    const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
    const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
    const A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
    const B2 = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
    const C = Math.sqrt(A * A + B2 * B2);
    let H = Math.atan2(B2, A) * 180 / Math.PI;
    if (H < 0) H += 360;
    return { l: L, c: C, h: H };
  }

  function hueDistance(a, b) {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
  }

  function analyzeColor(value, canvas = DEFAULT_CANVAS) {
    const hex = normalizeHex(value);
    const oklch = toOklch(hex);
    const contrast = contrastRatio(hex, canvas);
    return {
      hex,
      luminance: relativeLuminance(hex),
      oklch,
      neutral: oklch.c < CHROMA_MIN,
      contrastOnCanvas: contrast,
      usableAccent: oklch.c >= CHROMA_MIN && contrast >= ACCENT_CONTRAST_MIN
    };
  }

  function classifyPalette(colors, canvas = DEFAULT_CANVAS) {
    const raw = Array.isArray(colors) ? colors.slice(0, 2) : [];
    const first = analyzeColor(raw[0] || DEFAULT_INK, canvas);
    const second = raw[1] ? analyzeColor(raw[1], canvas) : null;
    if (!second || (!first.usableAccent && !second.usableAccent)) return 'MONO_ACCENT';
    if (first.usableAccent && second.usableAccent) {
      const hueGap = hueDistance(first.oklch.h, second.oklch.h);
      const lightGap = Math.abs(first.oklch.l - second.oklch.l);
      return hueGap >= 36 || lightGap >= 0.22 ? 'DUAL_ACCENT' : 'TONAL_ACCENT';
    }
    return 'TONAL_ACCENT';
  }

  function resolve(colors, options = {}) {
    const canvas = normalizeHex(options.canvas || DEFAULT_CANVAS, DEFAULT_CANVAS);
    const raw = Array.isArray(colors) && colors.length
      ? colors.slice(0, 2).map((c, i) => normalizeHex(c, i === 0 ? DEFAULT_INK : DEFAULT_INK))
      : [DEFAULT_INK];
    const primary = analyzeColor(raw[0], canvas);
    const secondary = raw[1] ? analyzeColor(raw[1], canvas) : null;

    // Narrow, deterministic resolver frozen during Ivory v2.4 work:
    // chromatic usable primary wins; otherwise usable secondary; otherwise ink.
    let accent = DEFAULT_INK;
    if (primary.usableAccent) accent = primary.hex;
    else if (secondary && secondary.usableAccent) accent = secondary.hex;

    let accentSecondary = accent;
    if (secondary && secondary.usableAccent && secondary.hex !== accent) accentSecondary = secondary.hex;
    else if (primary.usableAccent && primary.hex !== accent) accentSecondary = primary.hex;

    return {
      raw,
      mode: classifyPalette(raw, canvas),
      roles: {
        ink: DEFAULT_INK,
        surface: canvas,
        accent,
        accentSecondary,
        ambientAccent: accent
      },
      analysis: {
        primary,
        secondary
      }
    };
  }

  return {
    DEFAULT_INK,
    DEFAULT_CANVAS,
    ACCENT_CONTRAST_MIN,
    CHROMA_MIN,
    normalizeHex,
    relativeLuminance,
    contrastRatio,
    toOklch,
    analyzeColor,
    classifyPalette,
    resolve
  };
});
