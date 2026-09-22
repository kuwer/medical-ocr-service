import { AppError } from '../middleware/AppError';
import { extractMarkdown } from './ocr/marker';
import { parseReport } from './parsing/reportParser';
import { toFhirObservation } from './fhir/mapper';
import { needsReview } from './validation/validator';
import { FhirBundle } from '../types/fhir';

const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export async function extractReport(file: Express.Multer.File): Promise<FhirBundle> {
  if (!SUPPORTED_MIME_TYPES.has(file.mimetype)) {
    throw new AppError(
      400,
      `Unsupported file type "${file.mimetype}". Supported types: JPEG, PNG, WebP, PDF.`
    );
  }

  const markdown = await extractMarkdown(file.buffer, file.originalname, file.mimetype);
  const parsedRows = parseReport(markdown);

  if (parsedRows.length === 0) {
    throw new AppError(422, 'OCR completed but no extractable observations were found in the report.');
  }

  const needsReviewNames: string[] = [];
  const entries = parsedRows.map((row) => {
    if (needsReview(row)) {
      needsReviewNames.push(row.testName);
    }
    return { resource: toFhirObservation(row) };
  });

  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: entries,
    meta: {
      source: 'ocr-extraction',
      needsReview: needsReviewNames,
    },
  };
}

export function assertFile(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
  if (!file) {
    throw new AppError(400, 'No file uploaded. Send it as multipart/form-data under the "file" field.');
  }
}