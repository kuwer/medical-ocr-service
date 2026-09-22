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

    // Patient/sample information is also rendered as a markdown table, but
    // it is not a set of observations.
    if (isMetadataTable(headerCells)) {
      while (i < lines.length && isTableRow(lines[i])) {
        i++;
      }
      continue;
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

function isMetadataTable(headerCells: string[]): boolean {
  const header = headerCells.join(' ').toLowerCase();
  return ['patient information', 'sample information', 'client/location information'].some(
    (label) => header.includes(label)
  );
}

function rowToObservation(
  cells: string[],
  columnIndex: { test: number; result: number; unit: number; range: number }
): ParsedObservation | null {
  // Fall back to positional guess (name, value, unit, range) when the
  // header didn't clearly label columns.
  const hasMappedColumns = Object.values(columnIndex).some((index) => index >= 0);
  const testIdx = columnIndex.test >= 0 ? columnIndex.test : 0;
  const resultIdx = columnIndex.result >= 0 ? columnIndex.result : cells.length >= 5 ? 2 : 1;
  const unitIdx = columnIndex.unit >= 0 ? columnIndex.unit : cells.length >= 5 ? 3 : 2;
  const rangeIdx = columnIndex.range >= 0 ? columnIndex.range : cells.length >= 5 ? 4 : 3;

  const testName = cleanTestName(cells[testIdx]?.trim() || '');
  let rawResult = cells[resultIdx]?.trim();
  let unit = unitIdx < cells.length ? cells[unitIdx]?.trim() : '';
  const rangeText = rangeIdx < cells.length ? cells[rangeIdx]?.trim() : '';

  if (
    !testName ||
    !rawResult ||
    isHeaderLike(testName) ||
    isReportMetadataRow(testName) ||
    (!hasMappedColumns && testName === 'Differential Count')
  ) {
    return null;
  }

  // Marker can shift columns when a report contains a method or sample cell.
  // Recover a numeric result only from a non-range cell; never treat a
  // reference interval as the measured value.
  if (parseValueAndUnit(rawResult).value === null) {
    const fallback = cells.find((cell, index) => {
      if (index === testIdx || index === rangeIdx) return false;
      const text = cell.trim();
      return parseRange(text).low === null && parseValueAndUnit(text).value !== null;
    });
    if (fallback) rawResult = fallback.trim();
  }

  // Some reports combine value + unit in one cell, e.g. "11.2 g/dL".
  const { value, rawValue, unit: inlineUnit } = parseValueAndUnit(rawResult);
  if (!unit && inlineUnit) {
    unit = inlineUnit;
  }

  let { low, high } = parseRange(rangeText);
  if (unit) {
    const rangeWithUnit = parseRangeAndUnit(unit);
    if (rangeWithUnit) {
      if (low === null) low = rangeWithUnit.low;
      if (high === null) high = rangeWithUnit.high;
      unit = rangeWithUnit.unit;
    } else if (parseRange(unit).low !== null) {
      const nextCell = cells[rangeIdx + 1]?.trim();
      const nextCellRange = parseRange(nextCell || '');
      ({ low, high } = parseRange(unit));
      unit = nextCell && nextCellRange.low === null ? nextCell : '';
    }
  }

  if (!unit) {
    const unitCell = cells.find((cell, index) => {
      const text = cell.trim();
      return index !== testIdx && index !== resultIdx && parseRange(text).low === null
        && text.length <= 32 && !text.includes(':') && /[A-Za-z%µμ/]/.test(text);
    });
    unit = unitCell?.trim() || '';
  }

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
  return /^(primary sample type|name|age|sex|sex\/age|p\. id(?: no\.?)?|accession no|referring doctor|referred by|referring by|ref\. id|ref\. by|interpretation|unknown)\s*:?(?:\s|$)/i.test(text)
    || /^-+$/.test(text)
    || text.startsWith('-');
}

function cleanTestName(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+(?:Sample|Method)\s*:.*/i, '')
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
  const rawValue = token.replace(/<[^>]+>/g, '').trim();
  const numericToken = rawValue.replace(/^[HLN]\s+/i, '');
  // Leading numeric portion, e.g. "11.2" out of "11.2*" or "11.2 g/dL".
  const numMatch = /^-?\d+(\.\d+)?/.exec(numericToken);
  const value = numMatch ? parseFloat(numMatch[0]) : null;

  // Anything alphabetic left after stripping the number/whitespace is
  // treated as an inline unit (e.g. "7800/cumm" -> unit "/cumm").
  const remainder = numericToken.replace(numMatch?.[0] || '', '').trim();
  const unit = /[A-Za-z/%µμ]/.test(remainder) ? remainder : null;

  return { value, rawValue, unit };
}

function parseRange(text: string): { low: number | null; high: number | null } {
  if (!text) return { low: null, high: null };
  const match = /(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?)/.exec(text);
  if (!match) return { low: null, high: null };
  return { low: parseFloat(match[1]), high: parseFloat(match[2]) };
}

function parseRangeAndUnit(text: string): { low: number; high: number; unit: string } | null {
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?)(?:\s+(.+))?\s*$/i.exec(text);
  if (!match || !match[3]) return null;
  return { low: parseFloat(match[1]), high: parseFloat(match[2]), unit: match[3].trim() };
}
