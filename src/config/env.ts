import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),

  db: {
    host: required('DB_HOST'),
    port: Number(process.env.DB_PORT ?? 3306),
    database: required('DB_DATABASE'),
    user: required('DB_USERNAME'),
    password: process.env.DB_PASSWORD ?? '',
  },

  jwtSecret: required('JWT_SECRET'),
  jwtAlgo: (process.env.JWT_ALGO ?? 'HS256') as 'HS256',

  mediaStorageRoot: process.env.MEDIA_STORAGE_ROOT ?? '../web/storage/app/public',
  publicMediaBaseUrl: process.env.PUBLIC_MEDIA_BASE_URL ?? '',

  laravelInternalPushUrl: process.env.LARAVEL_INTERNAL_PUSH_URL ?? '',
  chatPushInternalSecret: process.env.CHAT_PUSH_INTERNAL_SECRET ?? '',

  corsOrigin: process.env.CORS_ORIGIN ?? '*',
};
