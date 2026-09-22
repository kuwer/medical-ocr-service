import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { AppError } from '../middleware/AppError';
import { asyncHandler } from '../middleware/errorHandler';
import { assertFile, extractReport } from '../services/extraction';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const requestTimes = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;

function rateLimitWebUpload(req: Request, _res: Response, next: NextFunction): void {
  const now = Date.now();
  const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
  const recent = (requestTimes.get(clientKey) || []).filter((time) => now - time < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    throw new AppError(429, 'Demo upload limit reached. Please try again later.');
  }

  recent.push(now);
  requestTimes.set(clientKey, recent);
  next();
}

router.post(
  '/web/extract',
  rateLimitWebUpload,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    assertFile(req.file);
    res.status(200).json(await extractReport(req.file));
  })
);

export default router;