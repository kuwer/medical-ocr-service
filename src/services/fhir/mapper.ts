import { CodeableConcept, InterpretationCode, Observation } from '../../types/fhir';
import { ParsedObservation } from '../../types/ocr';
import { lookupLoinc } from './loinc';

const INTERPRETATION_DISPLAY: Record<InterpretationCode, string> = {
  L: 'Low',
  H: 'High',
  N: 'Normal',
};

/**
 * Maps one parsed report row into a FHIR R4 Observation resource.
 * Pure function: no HTTP, no validation side effects — just shape
 * transformation, so it's trivially unit-testable in isolation.
 */
export function toFhirObservation(row: ParsedObservation): Observation {
  const observation: Observation = {
    resourceType: 'Observation',
    status: 'preliminary',
    code: buildCode(row.testName),
  };

  if (row.value !== null && row.unit?.trim()) {
    observation.valueQuantity = {
      value: row.value,
      unit: row.unit,
      system: 'http://unitsofmeasure.org',
      code: row.unit,
    };
  } else {
    observation.dataAbsentReason = {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/data-absent-reason', code: 'unknown', display: 'Unknown' }],
      text: 'OCR value or unit could not be validated',
    };
  }

  const interpretation = computeInterpretation(row);
  if (interpretation) {
    observation.interpretation = [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
            code: interpretation,
            display: INTERPRETATION_DISPLAY[interpretation],
          },
        ],
      },
    ];
  }

  if (row.refLow !== null || row.refHigh !== null) {
    observation.referenceRange = [
      {
        ...(row.refLow !== null ? { low: { value: row.refLow, unit: row.unit ?? '' } } : {}),
        ...(row.refHigh !== null ? { high: { value: row.refHigh, unit: row.unit ?? '' } } : {}),
      },
    ];
  }

  return observation;
}

function buildCode(testName: string): CodeableConcept {
  const loinc = lookupLoinc(testName);
  if (!loinc) {
    return { text: testName };
  }
  return {
    text: testName,
    coding: [{ system: 'http://loinc.org', code: loinc.code, display: loinc.display }],
  };
}

function computeInterpretation(row: ParsedObservation): InterpretationCode | null {
  if (row.value === null || row.refLow === null || row.refHigh === null) {
    return null;
  }
  if (row.value < row.refLow) return 'L';
  if (row.value > row.refHigh) return 'H';
  return 'N';
}
