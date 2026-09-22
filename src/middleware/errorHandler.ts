import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from './AppError';

/**
 * Single place that turns any thrown/next(err) error into a JSON response.
 * Keeps status-code decisions out of route handlers and guarantees we
 * never leak a stack trace to the client (per the 500 requirement).
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: `Upload error: ${err.message}` });
    return;
  }

  const message = err instanceof Error ? err.message : 'Unknown error';

  // Anything unhandled is treated as an upstream/internal failure.
  // Log the full error server-side for debugging, but only return the
  // message to the client — never the stack trace.
  console.error('Unhandled error:', sanitizeError(err));
  res.status(500).json({ error: message || 'Internal server error' });
}

function sanitizeError(err: unknown): { name: string; message: string; status?: number } {
  if (err instanceof Error) {
    const axiosError = err as Error & { response?: { status?: number } };
    return { name: err.name, message: err.message, status: axiosError.response?.status };
  }
  return { name: 'UnknownError', message: 'Unknown error' };
}

/**
 * Wraps an async route handler so rejected promises reach errorHandler
 * via next(err), since Express 4 does not do this automatically.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
