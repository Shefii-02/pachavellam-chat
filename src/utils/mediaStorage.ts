import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { env } from '../config/env.js';

const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  image: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  video: ['.mp4', '.mov', '.m4v', '.webm'],
  audio: ['.mp3', '.m4a', '.aac', '.wav'],
  voice_note: ['.m4a', '.aac', '.wav', '.webm', '.ogg'],
  document: ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt'],
};

export function isExtensionAllowed(type: string, filename: string): boolean {
  const allowed = ALLOWED_EXTENSIONS[type];
  if (!allowed) return false;
  const ext = path.extname(filename).toLowerCase();
  return allowed.includes(ext);
}

/**
 * Writes a buffer to `${MEDIA_STORAGE_ROOT}/chat/{conversationId}/{uuid}{ext}`
 * — the same directory Laravel's `public` disk resolves to, so the file is
 * immediately servable through the existing `/storage/...` route with zero
 * changes on the Laravel side.
 */
export async function saveChatMedia(params: {
  conversationId: number;
  originalFilename: string;
  buffer: Buffer;
}): Promise<{ diskPath: string; publicUrl: string }> {
  const ext = path.extname(params.originalFilename).toLowerCase();
  const filename = `${randomUUID()}${ext}`;
  const relativeDir = path.posix.join('chat', String(params.conversationId));
  const absoluteDir = path.join(env.mediaStorageRoot, relativeDir);

  await mkdir(absoluteDir, { recursive: true });
  const absolutePath = path.join(absoluteDir, filename);
  await writeFile(absolutePath, params.buffer);

  const diskPath = path.posix.join(relativeDir, filename);
  const publicUrl = `${env.publicMediaBaseUrl}/${diskPath}`;

  return { diskPath, publicUrl };
}
