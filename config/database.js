import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  min: 2,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 15000,
  statement_timeout: 30000,
  query_timeout: 30000,
  keepAlive: true,
  ssl: {
    rejectUnauthorized: false,
    servername: process.env.DB_HOST
  },
});

pool.on('connect', () => {
  console.log('✅ HRMS: Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ HRMS: Database connection error:', err);
  process.exit(-1);
});

pool.on('acquire', () => {
  console.log('🔄 HRMS: Connection acquired from pool');
});

pool.on('release', () => {
  console.log('🔄 HRMS: Connection released back to pool');
});

export default pool;