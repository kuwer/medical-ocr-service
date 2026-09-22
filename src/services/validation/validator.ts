import { ParsedObservation } from '../../types/ocr';

/**
 * Runs the two sanity checks the spec asks for:
 *   1. Value is a valid number (not contaminated, e.g. "11.2*")
 *   2. Unit is present
 *
 * Returns true if the row NEEDS review (i.e. failed a check). The row
 * itself is never dropped here — the caller still includes it in the
 * Bundle and only uses this flag to populate meta.needsReview.
 */
export function needsReview(row: ParsedObservation): boolean {
  return !isValidNumber(row) || !hasUnit(row);
}

/**
 * A value is only "clean" if the raw OCR token parses as a number with
 * nothing left over — "11.2" passes, "11.2*" and "11.2 mg" (unit stuck
 * to the value) do not, even though we can still recover 11.2 from them.
 */
export function isValidNumber(row: ParsedObservation): boolean {
  if (row.value === null) return false;
  return row.rawValue.trim() === formatNumber(row.value);
}

export function hasUnit(row: ParsedObservation): boolean {
  return typeof row.unit === 'string' && row.unit.trim().length > 0;
}

function formatNumber(value: number): string {
  return String(value);
}
