import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const sslEnabled =
  process.env.DATABASE_SSL === "true" ||
  process.env.DATABASE_URL.includes("sslmode=require");

// Certificates are verified by default. For a private CA (e.g. RDS) point
// NODE_EXTRA_CA_CERTS at the CA bundle; DATABASE_SSL_NO_VERIFY=true opts out.
const sslNoVerify = process.env.DATABASE_SSL_NO_VERIFY === "true";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DATABASE_POOL_MAX || "5", 10),
  ssl: sslEnabled ? { rejectUnauthorized: !sslNoVerify } : undefined,
});
