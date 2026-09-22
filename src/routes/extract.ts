import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/errorHandler';
import { assertFile, extractReport } from '../services/extraction';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB — generous for a phone photo or scanned PDF
});

router.post(
  '/extract',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    assertFile(req.file);
    res.status(200).json(await extractReport(req.file));
  })
);

export default router;
