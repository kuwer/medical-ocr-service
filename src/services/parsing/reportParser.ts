import { ParsedObservation } from '../../types/ocr';

/**
 * Turns Marker's OCR'd markdown into rows of { testName, value, unit, refLow, refHigh }.
 *
 * KNOWN LIMITATION (documented in README): this is a heuristic parser tuned
 * for standard CBC/LFT-style report layouts (Thyrocare/SRL and similar),
 * either as a markdown table or as space-separated plain-text lines. It is
 * not a general table-understanding engine — unusual layouts (multi-line
 * cells, merged headers, non-English test names) may be missed or
 * misparsed. Rows it can't confidently parse are simply skipped rather
 * than guessed at.
 */
export function parseReport(markdown: string): ParsedObservation[] {
  const fromTables = extractFromMarkdownTables(markdown);
  if (fromTables.length > 0) {
    return fromTables;
  }
  return extractFromPlainText(markdown);
}

// ---------- Markdown table extraction ----------

const HEADER_KEYWORDS = {
  test: ['test', 'investigation', 'parameter', 'analyte'],
  result: ['result', 'value', 'observed'],
  unit: ['unit'],
  range: ['reference', 'range', 'normal', 'biological ref'],
};

function extractFromMarkdownTables(markdown: string): ParsedObservation[] {
  const lines = markdown.split('\n');
  const results: ParsedObservation[] = [];

  let i = 0;
  while (i < lines.length) {
    if (!isTableRow(lines[i])) {
      i++;
      continue;
    }

    // Found the start of a table block: header row + separator + data rows.
    const headerCells = splitRow(lines[i]);
    const columnIndex = mapColumns(headerCells);
    i++; // move past header

    if (i < lines.length && isSeparatorRow(lines[i])) {
      i++; // skip the |---|---| separator row
    }

    while (i < lines.length && isTableRow(lines[i])) {
      const cells = splitRow(lines[i]);
      const parsed = rowToObservation(cells, columnIndex);
      if (parsed) {
        results.push(parsed);
      }
      i++;
    }
  }

  return results;
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith('|') && line.trim().split('|').length >= 3;
}

function isSeparatorRow(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-');
}

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\||\|$/g, '');
  return trimmed.split('|').map((c) => c.trim());
}

function mapColumns(headerCells: string[]): {
  test: number;
  result: number;
  unit: number;
  range: number;
} {
  const find = (keywords: string[]): number =>
    headerCells.findIndex((cell) =>
      keywords.some((kw) => cell.toLowerCase().includes(kw))
    );

  return {
    test: find(HEADER_KEYWORDS.test),
    result: find(HEADER_KEYWORDS.result),
    unit: find(HEADER_KEYWORDS.unit),
    range: find(HEADER_KEYWORDS.range),
  };
}

function rowToObservation(
  cells: string[],
  columnIndex: { test: number; result: number; unit: number; range: number }
): ParsedObservation | null {
  // Fall back to positional guess (name, value, unit, range) when the
  // header didn't clearly label columns.
  const testIdx = columnIndex.test >= 0 ? columnIndex.test : 0;
  const resultIdx = columnIndex.result >= 0 ? columnIndex.result : 1;
  const unitIdx = columnIndex.unit >= 0 ? columnIndex.unit : 2;
  const rangeIdx = columnIndex.range >= 0 ? columnIndex.range : 3;

  const testName = cleanTestName(cells[testIdx]?.trim() || '');
  const rawResult = cells[resultIdx]?.trim();
  let unit = unitIdx < cells.length ? cells[unitIdx]?.trim() : '';
  const rangeText = rangeIdx < cells.length ? cells[rangeIdx]?.trim() : '';

  if (!testName || !rawResult || isHeaderLike(testName) || isReportMetadataRow(testName)) {
    return null;
  }

  // Some reports combine value + unit in one cell, e.g. "11.2 g/dL".
  const { value, rawValue, unit: inlineUnit } = parseValueAndUnit(rawResult);
  if (!unit && inlineUnit) {
    unit = inlineUnit;
  }

  const { low, high } = parseRange(rangeText);

  return {
    testName,
    rawValue,
    value,
    unit: unit || null,
    refLow: low,
    refHigh: high,
  };
}

function isHeaderLike(text: string): boolean {
  const lower = text.toLowerCase();
  return HEADER_KEYWORDS.test.some((kw) => lower === kw) || lower === 'test name';
}

function isReportMetadataRow(text: string): boolean {
  return /^primary sample type\s*:?$/i.test(text);
}

function cleanTestName(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- Plain-text fallback extraction ----------

// e.g. "Hemoglobin        11.2 *    g/dL    12.0 - 16.0"
const PLAIN_LINE_PATTERN =
  /^([A-Za-z][A-Za-z0-9()./\- ]{2,45}?)\s+([\d.]+\s*\*?)\s+([A-Za-z/%µμ][A-Za-z/%µμ0-9]{0,12})\s+([\d.]+)\s*(?:-|–|to)\s*([\d.]+)\s*$/;

function extractFromPlainText(markdown: string): ParsedObservation[] {
  const results: ParsedObservation[] = [];

  for (const line of markdown.split('\n')) {
    const match = PLAIN_LINE_PATTERN.exec(line.trim());
    if (!match) continue;

    const [, testName, rawValueToken, unit, lowStr, highStr] = match;
    const { value, rawValue } = parseValueAndUnit(rawValueToken.trim());

    results.push({
      testName: testName.trim(),
      rawValue,
      value,
      unit: unit.trim(),
      refLow: parseFloat(lowStr),
      refHigh: parseFloat(highStr),
    });
  }

  return results;
}

// ---------- Shared value/unit/range parsing helpers ----------

function parseValueAndUnit(token: string): { value: number | null; rawValue: string; unit: string | null } {
  const rawValue = token.trim();
  // Leading numeric portion, e.g. "11.2" out of "11.2*" or "11.2 g/dL".
  const numMatch = /^-?\d+(\.\d+)?/.exec(rawValue);
  const value = numMatch ? parseFloat(numMatch[0]) : null;

  // Anything alphabetic left after stripping the number/whitespace is
  // treated as an inline unit (e.g. "7800/cumm" -> unit "/cumm").
  const remainder = rawValue.replace(numMatch?.[0] || '', '').trim();
  const unit = /[A-Za-z/%µμ]/.test(remainder) ? remainder : null;

  return { value, rawValue, unit };
}

function parseRange(text: string): { low: number | null; high: number | null } {
  if (!text) return { low: null, high: null };
  const match = /(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?)/.exec(text);
  if (!match) return { low: null, high: null };
  return { low: parseFloat(match[1]), high: parseFloat(match[2]) };
}
