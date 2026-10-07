import knexFactory, { type Knex } from 'knex';
import { env } from './env.js';

export const db: Knex = knexFactory({
  client: 'mysql2',
  connection: {
    host: env.db.host,
    port: env.db.port,
    database: env.db.database,
    user: env.db.user,
    password: env.db.password,
  },
  pool: { min: 2, max: 10 },
});
