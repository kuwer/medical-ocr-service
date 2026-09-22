/**
 * Error carrying an explicit HTTP status, so route handlers can `throw`
 * and let the central error handler translate it into a response —
 * instead of every handler building its own res.status(...).json(...).
 */
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}
