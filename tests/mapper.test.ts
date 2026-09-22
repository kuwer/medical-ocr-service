import { toFhirObservation } from '../src/services/fhir/mapper';
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

describe('toFhirObservation', () => {
  it('produces a valid Observation shape with status preliminary', () => {
    const obs = toFhirObservation(makeRow());
    expect(obs.resourceType).toBe('Observation');
    expect(obs.status).toBe('preliminary');
    expect(obs.valueQuantity).toBeDefined();
    expect(obs.valueQuantity?.value).toBe(11.2);
    expect(obs.valueQuantity?.unit).toBe('g/dL');
  });

  it('flags Low when value is below the reference range', () => {
    const obs = toFhirObservation(makeRow({ value: 10.0 }));
    expect(obs.interpretation?.[0].coding[0].code).toBe('L');
  });

  it('flags High when value is above the reference range', () => {
    const obs = toFhirObservation(makeRow({ value: 20.0 }));
    expect(obs.interpretation?.[0].coding[0].code).toBe('H');
  });

  it('flags Normal when value is within range', () => {
    const obs = toFhirObservation(makeRow({ value: 14.0 }));
    expect(obs.interpretation?.[0].coding[0].code).toBe('N');
  });

  it('omits interpretation when reference range is unavailable', () => {
    const obs = toFhirObservation(makeRow({ refLow: null, refHigh: null }));
    expect(obs.interpretation).toBeUndefined();
  });

  it('attaches a LOINC code for a recognized test name', () => {
    const obs = toFhirObservation(makeRow({ testName: 'Hemoglobin' }));
    expect(obs.code.coding?.[0].code).toBe('718-7');
  });

  it('falls back to text-only code for an unrecognized test name', () => {
    const obs = toFhirObservation(makeRow({ testName: 'Some Obscure Panel Marker' }));
    expect(obs.code.coding).toBeUndefined();
    expect(obs.code.text).toBe('Some Obscure Panel Marker');
  });

  it('does not fabricate a quantity when the value is invalid', () => {
    const obs = toFhirObservation(makeRow({ rawValue: 'N/A', value: null }));
    expect(obs.valueQuantity).toBeUndefined();
    expect(obs.dataAbsentReason?.coding?.[0].code).toBe('unknown');
  });
});
