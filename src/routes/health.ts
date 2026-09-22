import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'medical-report-ocr-service' });
});

export default router;
