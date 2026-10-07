import multer from 'multer';

/** Buffered in memory, then written to disk ourselves via mediaStorage.ts
 * (keeps the "write under Laravel's storage root" logic in one place). */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});
