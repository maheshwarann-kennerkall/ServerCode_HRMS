import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST ,
  port: process.env.DB_PORT ,
  database: process.env.DB_NAME ,
  user: process.env.DB_USER ,
  password: process.env.DB_PASSWORD ,
  max: 20,
  min: 2,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000,
  query_timeout: 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  ssl: {
    rejectUnauthorized: false,
    servername: process.env.DB_HOST
  },
});

export default pool;