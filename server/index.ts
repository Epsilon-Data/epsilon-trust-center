import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { pool } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(helmet());
app.use(express.json());

// CORS — configurable via CORS_ORIGIN env var
const corsOrigin = process.env.CORS_ORIGIN;
if (corsOrigin) {
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", corsOrigin);
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });
}

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", apiLimiter);

// PCR Registry — fetched from GitHub (epsilon-enclave/published/pcr-registry.json)
// Falls back to env vars if GitHub fetch fails
interface PCRVersion {
  version: string;
  pcr0: string;
  pcr1: string;
  pcr2: string;
  release_date: string;
  docker_image: string;
  source_commit?: string;
}

interface PCRRegistry {
  current_version: string;
  versions: PCRVersion[];
}

const GITHUB_OWNER = process.env.GITHUB_OWNER || "epsilon-data";
const GITHUB_REPO = process.env.GITHUB_REPO || "epsilon-enclave";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

let cachedRegistry: { data: PCRRegistry; fetchedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getPCRRegistry(): Promise<PCRRegistry> {
  if (cachedRegistry && Date.now() - cachedRegistry.fetchedAt < CACHE_TTL) {
    return cachedRegistry.data;
  }

  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/published/pcr-registry.json`;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.raw+json",
      "User-Agent": "epsilon-trust-center",
    };
    if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
    const data = (await res.json()) as PCRRegistry;
    cachedRegistry = { data, fetchedAt: Date.now() };
    console.log(`PCR registry fetched: ${data.versions.length} versions, current=${data.current_version}`);
    return data;
  } catch (err) {
    console.warn("Failed to fetch PCR registry from GitHub, using env var fallback:", err);
    // Fallback: construct single-version registry from env vars
    const fallback: PCRRegistry = {
      current_version: "unknown",
      versions: [],
    };
    if (process.env.EXPECTED_PCR0) {
      fallback.versions.push({
        version: "unknown",
        pcr0: process.env.EXPECTED_PCR0,
        pcr1: process.env.EXPECTED_PCR1 || "",
        pcr2: process.env.EXPECTED_PCR2 || "",
        release_date: "",
        docker_image: "",
      });
    }
    // Use fallback but don't cache it so we retry GitHub next time
    return fallback;
  }
}

function getExpectedPCRs(registry: PCRRegistry) {
  const current = registry.versions.find((v) => v.version === registry.current_version);
  if (!current || !current.pcr0) return null;
  return { pcr0: current.pcr0, pcr1: current.pcr1, pcr2: current.pcr2 };
}

// Extract PCR values from attestation JSON
function extractPCRsFromAttestation(attestation: unknown): { pcr0?: string; pcr1?: string; pcr2?: string } | null {
  try {
    const att = attestation as Record<string, unknown>;
    const doc = att?.attestation as Record<string, unknown>;
    if (!doc) return null;
    // PCRs might be stored in different places depending on the attestation format
    const pcrs = (doc as Record<string, unknown>)?.pcrs as Record<string, string> | undefined;
    if (pcrs) return { pcr0: pcrs["0"] || pcrs["pcr0"], pcr1: pcrs["1"] || pcrs["pcr1"], pcr2: pcrs["2"] || pcrs["pcr2"] };
    return null;
  } catch {
    return null;
  }
}

function findMatchingVersion(attestation: unknown, registry: PCRRegistry): string | null {
  const actual = extractPCRsFromAttestation(attestation);
  if (!actual?.pcr0) return null;
  for (const version of registry.versions) {
    if (version.pcr0 && actual.pcr0 === version.pcr0) return version.version;
  }
  return null;
}

// GET /api/stats - Aggregate stats for homepage
app.get("/api/stats", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE attestation IS NOT NULL AND status = 'success') AS total_verified,
        COUNT(*) FILTER (WHERE attestation IS NOT NULL AND status = 'success' AND created_at >= CURRENT_DATE) AS verified_today,
        COUNT(*) FILTER (WHERE status = 'failed') AS total_failed,
        COUNT(*) FILTER (WHERE status IN ('success', 'failed')) AS total_completed
      FROM job_requests
    `);
    const row = result.rows[0];
    const totalCompleted = parseInt(row.total_completed) || 0;
    const totalVerified = parseInt(row.total_verified) || 0;
    res.json({
      total_verified: totalVerified,
      verified_today: parseInt(row.verified_today) || 0,
      total_failed: parseInt(row.total_failed) || 0,
      success_rate: totalCompleted > 0
        ? Math.round((totalVerified / totalCompleted) * 1000) / 10
        : 0,
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

// GET /api/jobs - Paginated public ledger
app.get("/api/jobs", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const offset = (page - 1) * limit;

    const [jobsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT job_id, status, created_at, completed_at, commit_sha,
                verification_receipt, enclave_pcr0
         FROM job_requests
         WHERE status = 'success' AND attestation IS NOT NULL
         ORDER BY created_at DESC NULLS LAST
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM job_requests WHERE status = 'success' AND attestation IS NOT NULL`
      ),
    ]);

    const total = parseInt(countResult.rows[0].count) || 0;
    const registry = await getPCRRegistry();

    const jobs = jobsResult.rows.map((row) => {
      let receipt = null;
      try {
        receipt = typeof row.verification_receipt === "string"
          ? JSON.parse(row.verification_receipt)
          : row.verification_receipt;
      } catch { /* ignore parse errors */ }

      // Use receipt for verification status, fall back to PCR0 column match against registry
      let serverVerified: boolean | null = null;
      let pcr0Match: boolean | null = null;
      if (receipt) {
        serverVerified = receipt.valid ?? null;
        pcr0Match = receipt.checks?.pcr_verified ?? null;
      } else if (row.enclave_pcr0) {
        // Fallback: match enclave_pcr0 against registry
        pcr0Match = registry.versions.some((v) => v.pcr0 && v.pcr0 === row.enclave_pcr0);
      }

      return {
        job_id: row.job_id,
        has_attestation: true,
        completed_at: row.completed_at || row.created_at,
        commit_sha: row.commit_sha || "",
        pcr0_match: pcr0Match,
        server_verified: serverVerified,
      };
    });

    res.json({
      jobs,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Jobs error:", err);
    res.status(500).json({ message: "Failed to fetch jobs" });
  }
});

// GET /api/verify/:jobId - Full attestation data for a job
app.get("/api/verify/:jobId", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT job_id, status, created_at, completed_at, commit_sha,
              attestation, execution_output, exit_code, enclave_version,
              verification_receipt, enclave_pcr0
       FROM job_requests
       WHERE job_id = $1`,
      [req.params.jobId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: "Job not found" });
      return;
    }

    const row = result.rows[0];
    let attestation = null;
    if (row.attestation) {
      try {
        attestation = typeof row.attestation === "string"
          ? JSON.parse(row.attestation)
          : row.attestation;
      } catch {
        attestation = null;
      }
    }

    // Parse verification receipt (pre-computed by Python verifier)
    let receipt = null;
    if (row.verification_receipt) {
      try {
        receipt = typeof row.verification_receipt === "string"
          ? JSON.parse(row.verification_receipt)
          : row.verification_receipt;
      } catch {
        receipt = null;
      }
    }

    // Compute output hash if execution_output exists
    let executionOutputHash = null;
    if (row.execution_output) {
      executionOutputHash = crypto
        .createHash("sha256")
        .update(row.execution_output)
        .digest("hex");
    }

    // Load expected PCRs from registry — match against the version that produced this attestation
    const registry = await getPCRRegistry();
    // Try matching via enclave_pcr0 column first, fall back to extracting from attestation
    const pcr0ForMatch = row.enclave_pcr0 || receipt?.pcrs?.pcr0;
    let matchedVersion: string | null = null;
    let matchedEntry: PCRVersion | null = null;
    if (pcr0ForMatch) {
      for (const v of registry.versions) {
        if (v.pcr0 && v.pcr0 === pcr0ForMatch) {
          matchedVersion = v.version;
          matchedEntry = v;
          break;
        }
      }
    }
    if (!matchedVersion) {
      matchedVersion = findMatchingVersion(attestation, registry);
      matchedEntry = matchedVersion
        ? registry.versions.find((v) => v.version === matchedVersion) ?? null
        : null;
    }
    const expectedPCRs = matchedEntry
      ? { pcr0: matchedEntry.pcr0, pcr1: matchedEntry.pcr1, pcr2: matchedEntry.pcr2 }
      : getExpectedPCRs(registry);

    // Build server_verification from receipt
    const serverVerification = receipt ? {
      valid: receipt.valid,
      checks: {
        syntax_valid: receipt.checks?.syntax_valid ?? false,
        certificate_chain_valid: receipt.checks?.certificate_chain_valid ?? false,
        signature_valid: receipt.checks?.signature_valid ?? false,
        pcr_verified: receipt.checks?.pcr_verified ?? false,
        output_verified: receipt.checks?.output_verified ?? false,
      },
      pcrs: {
        pcr0: receipt.pcrs?.pcr0 || "",
        pcr1: receipt.pcrs?.pcr1 || "",
        pcr2: receipt.pcrs?.pcr2 || "",
      },
      module_id: receipt.module_id || "",
      timestamp: receipt.timestamp || "",
      timing: receipt.timing || {},
    } : null;

    // Build pcr_registry entry with source_url
    const pcrRegistry = matchedEntry ? {
      version: matchedEntry.version,
      pcr0: matchedEntry.pcr0,
      pcr1: matchedEntry.pcr1,
      pcr2: matchedEntry.pcr2,
      release_date: matchedEntry.release_date,
      docker_image: matchedEntry.docker_image,
      source_commit: matchedEntry.source_commit || "",
      source_url: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/tree/${matchedEntry.source_commit || "main"}`,
    } : null;

    res.json({
      job_id: row.job_id,
      status: row.status,
      created_at: row.created_at,
      completed_at: row.completed_at || row.created_at,
      commit_sha: row.commit_sha || "",
      attestation,
      execution_output_hash: executionOutputHash,
      enclave_pcrs: {
        expected: expectedPCRs,
        matched_version: matchedVersion,
        enclave_version: row.enclave_version || matchedVersion || null,
      },
      server_verification: serverVerification,
      pcr_registry: pcrRegistry,
    });
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ message: "Failed to fetch verification data" });
  }
});

// GET /api/pcr-registry - Published expected PCR values
app.get("/api/pcr-registry", async (_req, res) => {
  try {
    const registry = await getPCRRegistry();
    res.json(registry);
  } catch (err) {
    console.error("PCR registry error:", err);
    res.status(500).json({ message: "Failed to fetch PCR registry" });
  }
});

// Serve static frontend in production (dist/public/ from vite build)
const clientDist = path.resolve(__dirname, "public");
app.use(express.static(clientDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

const port = parseInt(process.env.PORT || "3001", 10);
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Trust Center running on port ${port}`);
});

// Graceful shutdown
function shutdown() {
  console.log("Shutting down...");
  server.close(() => {
    pool.end().then(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
