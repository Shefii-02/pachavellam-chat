import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Verifies the same JWT Laravel issues (php-open-source-saver/jwt-auth,
 * HS256, shared JWT_SECRET) directly — no round-trip to Laravel needed.
 * The `sub` claim is the user's bigint id (User::getJWTIdentifier()).
 */
export function authenticateHttp(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing bearer token' });
    return;
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: [env.jwtAlgo] });
    const sub = typeof payload === 'object' ? payload.sub : undefined;
    const userId = Number(sub);
    if (!sub || Number.isNaN(userId)) {
      res.status(401).json({ message: 'Invalid token subject' });
      return;
    }
    req.userId = userId;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
