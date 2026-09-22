/**
 * Minimal FHIR R4 type definitions — only the shapes this service produces.
 * Not a full FHIR type library by design; see README for scope notes.
 */

export type InterpretationCode = 'L' | 'H' | 'N';

export interface Coding {
  system: string;
  code: string;
  display: string;
}

export interface CodeableConcept {
  coding?: Coding[];
  text: string;
}

export interface Quantity {
  value: number;
  unit: string;
  system?: string;
  code?: string;
}

export interface ReferenceRange {
  low?: { value: number; unit: string };
  high?: { value: number; unit: string };
}

export interface Observation {
  resourceType: 'Observation';
  status: 'preliminary';
  code: CodeableConcept;
  valueQuantity?: Quantity;
  dataAbsentReason?: CodeableConcept;
  interpretation?: [{ coding: Coding[] }];
  referenceRange?: ReferenceRange[];
}

export interface BundleEntry {
  resource: Observation;
}

export interface FhirBundle {
  resourceType: 'Bundle';
  type: 'collection';
  entry: BundleEntry[];
  meta: {
    source: string;
    needsReview: string[];
  };
}
