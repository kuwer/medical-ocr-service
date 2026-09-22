import { hasUnit, isValidNumber, needsReview } from '../src/services/validation/validator';
import { ParsedObservation } from '../src/types/ocr';

function makeRow(overrides: Partial<ParsedObservation> = {}): ParsedObservation {
  return {
    testName: 'Hemoglobin',
    rawValue: '11.2',
    value: 11.2,
    unit: 'g/dL',
    refLow: 12.0,
    refHigh: 16.0,
    ...overrides,
  };
}

describe('isValidNumber', () => {
  it('passes a clean numeric value', () => {
    expect(isValidNumber(makeRow({ rawValue: '11.2', value: 11.2 }))).toBe(true);
  });

  it('passes a clean integer value', () => {
    expect(isValidNumber(makeRow({ rawValue: '7800', value: 7800 }))).toBe(true);
  });

  it('fails a value contaminated with a trailing marker (e.g. "11.2*")', () => {
    expect(isValidNumber(makeRow({ rawValue: '11.2*', value: 11.2 }))).toBe(false);
  });

  it('fails when no numeric value could be parsed at all', () => {
    expect(isValidNumber(makeRow({ rawValue: 'N/A', value: null }))).toBe(false);
  });
});

describe('hasUnit', () => {
  it('passes when a unit is present', () => {
    expect(hasUnit(makeRow({ unit: 'g/dL' }))).toBe(true);
  });

  it('fails when unit is null', () => {
    expect(hasUnit(makeRow({ unit: null }))).toBe(false);
  });

  it('fails when unit is an empty/whitespace string', () => {
    expect(hasUnit(makeRow({ unit: '   ' }))).toBe(false);
  });
});

describe('needsReview', () => {
  it('is false for a fully clean row', () => {
    expect(needsReview(makeRow())).toBe(false);
  });

  it('is true when the value is contaminated', () => {
    expect(needsReview(makeRow({ rawValue: '11.2*' }))).toBe(true);
  });

  it('is true when the unit is missing', () => {
    expect(needsReview(makeRow({ unit: null }))).toBe(true);
  });

  it('is true when both value and unit checks fail', () => {
    expect(needsReview(makeRow({ rawValue: '11.2*', unit: null }))).toBe(true);
  });
});
