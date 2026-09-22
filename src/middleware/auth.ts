import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { AppError } from './AppError';

/**
 * Validates `Authorization: Bearer <token>` against the static token
 * configured via AUTH_TOKEN. Any static-token scheme is inherently a
 * shared secret — fine for this assignment's scope, but a production
 * healthcare platform would want per-client tokens and rotation.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('Authorization');

  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError(401, 'Missing or malformed Authorization header. Expected: Bearer <token>');
  }

  const token = header.slice('Bearer '.length).trim();

  if (token !== env.authToken) {
    throw new AppError(401, 'Invalid bearer token');
  }

  next();
}
