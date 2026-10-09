// CSV export helpers - pure, no dependency.

/**
 * Last-resort protection against spreadsheet formula injection: a cell that
 * starts with = + - @ (or a tab / carriage return) can be evaluated as a
 * formula (in Excel, "+1-418-805-5602" displays as -6824), so it gets a
 * leading apostrophe. Excel does display that apostrophe (checked by LP), so
 * callers first rewrite their values into a shape that doesn't need it when
 * they can (see phoneForCsv); this only catches what's left.
 */
export function neutralizeCsvFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
