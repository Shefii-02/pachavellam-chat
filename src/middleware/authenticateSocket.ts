import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AuthenticatedSocket extends Socket {
  userId: number;
}

export function authenticateSocket(socket: Socket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    next(new Error('Missing auth token'));
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: [env.jwtAlgo] });
    const sub = typeof payload === 'object' ? payload.sub : undefined;
    const userId = Number(sub);
    if (!sub || Number.isNaN(userId)) {
      next(new Error('Invalid token subject'));
      return;
    }
    (socket as AuthenticatedSocket).userId = userId;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
}
