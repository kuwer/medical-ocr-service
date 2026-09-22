import { Router } from 'express';
import multer from 'multer';
import { AppError } from '../middleware/AppError';
import { asyncHandler } from '../middleware/errorHandler';
import { extractMarkdown } from '../services/ocr/marker';
import { parseReport } from '../services/parsing/reportParser';
import { toFhirObservation } from '../services/fhir/mapper';
import { needsReview } from '../services/validation/validator';
import { FhirBundle } from '../types/fhir';

const router = Router();

const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB — generous for a phone photo or scanned PDF
});

router.post(
  '/extract',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, 'No file uploaded. Send it as multipart/form-data under the "file" field.');
    }

    if (!SUPPORTED_MIME_TYPES.has(req.file.mimetype)) {
      throw new AppError(
        400,
        `Unsupported file type "${req.file.mimetype}". Supported types: JPEG, PNG, WebP, PDF.`
      );
    }

    const markdown = await extractMarkdown(req.file.buffer, req.file.originalname, req.file.mimetype);
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

    const bundle: FhirBundle = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: entries,
      meta: {
        source: 'ocr-extraction',
        needsReview: needsReviewNames,
      },
    };

    res.status(200).json(bundle);
  })
);

export default router;
