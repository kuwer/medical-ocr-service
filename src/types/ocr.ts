/** Shape returned by Datalab Marker's poll endpoint once processing finishes. */
export interface MarkerPollResult {
  status: 'processing' | 'complete' | 'failed';
  success?: boolean;
  markdown?: string;
  result_url?: string;
  error?: string;
  page_count?: number;
}

/**
 * One row extracted from the OCR'd report text, before FHIR mapping.
 * `rawValue` keeps the original OCR string (e.g. "11.2*") so validation
 * can flag rows where numeric parsing had to strip something off.
 */
export interface ParsedObservation {
  testName: string;
  rawValue: string;
  value: number | null;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
}
