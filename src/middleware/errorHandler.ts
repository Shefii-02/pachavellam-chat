import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({ message: 'Validation failed', errors: err.flatten() });
    return;
  }

  console.error(err);
  res.status(500).json({ message: 'Something went wrong' });
}

export function notFound(message = 'Not found'): HttpError {
  return new HttpError(404, message);
}

export function forbidden(message = 'Forbidden'): HttpError {
  return new HttpError(403, message);
}

export function badRequest(message = 'Bad request'): HttpError {
  return new HttpError(400, message);
}
