import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const sslEnabled =
  process.env.DATABASE_SSL === "true" ||
  process.env.DATABASE_URL.includes("sslmode=require");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DATABASE_POOL_MAX || "5", 10),
  ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
});
