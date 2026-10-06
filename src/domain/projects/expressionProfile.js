// V1 curated expression grammar, independent of brand identity and content.
export const EXPRESSION_PROFILES = Object.freeze(['balanced', 'editorial', 'panoramic']);
export function isExpressionProfile(value) {
  return typeof value === 'string' && EXPRESSION_PROFILES.includes(value);
}
