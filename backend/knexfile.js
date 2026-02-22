import 'dotenv/config';

export default {
  client: 'pg',
  connection: process.env.DATABASE_URL || {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'eadeies',
    user: process.env.DB_USER || 'eadeies',
    password: process.env.DB_PASS || 'eadeies',
  },
  migrations: {
    directory: './migrations',
    extension: 'js',
  },
  seeds: {
    directory: './seeds',
  },
};
