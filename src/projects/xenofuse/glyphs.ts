// The alien "font" (spec.md section 5): a fixed set of glyphs reused across
// every puzzle type so the device reads as one consistent alien system
// instead of each stage inventing its own look. All drawn from the Unicode
// Geometric Shapes block, which keeps stroke weight and style consistent
// and renders reliably cross-platform (no custom font/icon needed).
export const GLYPHS = [
  '◆', '◇', '◈', '◊', '◌', '◍', '◎', '◐',
  '◑', '◒', '◓', '◔', '◕', '◖', '◗', '◘',
  '◙', '◚', '◛', '◜', '◝', '◞', '◟', '◠',
  '◡', '◢', '◣', '◤', '◥', '◦', '◫', '◬',
] as const

// Marks a not-yet-known slot in a puzzle's displayed code (e.g. the hidden
// tail of a sequence) -- visually distinct from every real glyph above.
export const UNKNOWN_GLYPH = '▢'
