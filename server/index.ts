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

// ── ATL (Attestation Transparency Log) proxy ──
// Proxies requests to the ATL service, converting CBOR→JSON for the frontend.
// All ATL endpoints are public (no auth on GET).
const ATL_BASE_URL = process.env.ATL_BASE_URL || "";

interface ATLSTHResponse {
  tree_size: number;
  root_hash: string;
  timestamp: number;
  signature: string;
}

// GET /api/atl/status — ATL availability + latest STH
app.get("/api/atl/status", async (_req, res) => {
  if (!ATL_BASE_URL) {
    res.json({ enabled: false });
    return;
  }
  try {
    const sthRes = await fetch(`${ATL_BASE_URL}/v1/sth`);
    if (!sthRes.ok) {
      res.json({ enabled: true, connected: false });
      return;
    }
    // ATL returns CBOR, but we also accept JSON for flexibility
    const contentType = sthRes.headers.get("content-type") || "";
    let sth: ATLSTHResponse;
    if (contentType.includes("cbor")) {
      // For CBOR responses, read as buffer and decode
      // Since we don't have a CBOR decoder in the frontend server,
      // we'll configure ATL to also support JSON, or use raw bytes
      // For now, try JSON first
      const text = await sthRes.text();
      sth = JSON.parse(text);
    } else {
      sth = await sthRes.json() as ATLSTHResponse;
    }
    res.json({
      enabled: true,
      connected: true,
      sth: {
        tree_size: sth.tree_size,
        root_hash: Buffer.isBuffer(sth.root_hash) ? Buffer.from(sth.root_hash).toString("hex") : sth.root_hash,
        timestamp: sth.timestamp,
      },
    });
  } catch (err) {
    console.warn("ATL status check failed:", err);
    res.json({ enabled: true, connected: false });
  }
});

// GET /api/atl/entries — paginated log entries from the ATL database directly
app.get("/api/atl/entries", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const offset = (page - 1) * limit;
    const entryType = req.query.type as string | undefined;

    let whereClause = "";
    const params: (number | string)[] = [limit, offset];

    if (entryType && ["1", "2", "3"].includes(entryType)) {
      whereClause = "WHERE entry_type = $3";
      params.push(parseInt(entryType));
    }

    const [entriesResult, countResult] = await Promise.all([
      pool.query(
        `SELECT leaf_index, entry_type, leaf_hash, job_id, tee_platform, submitter_id, submitted_at
         FROM atl_entries
         ${whereClause}
         ORDER BY leaf_index DESC
         LIMIT $1 OFFSET $2`,
        params
      ),
      pool.query(
        `SELECT COUNT(*) FROM atl_entries ${whereClause}`,
        entryType && ["1", "2", "3"].includes(entryType) ? [parseInt(entryType)] : []
      ),
    ]);

    const total = parseInt(countResult.rows[0].count) || 0;

    const entries = entriesResult.rows.map((row) => ({
      leaf_index: parseInt(row.leaf_index) - 1, // 0-based for display
      entry_type: row.entry_type,
      entry_type_label: row.entry_type === 1 ? "HA" : row.entry_type === 2 ? "LA" : "Config",
      leaf_hash: row.leaf_hash instanceof Buffer ? row.leaf_hash.toString("hex") : row.leaf_hash,
      job_id: row.job_id || null,
      tee_platform: row.tee_platform || null,
      submitter_id: row.submitter_id,
      submitted_at: row.submitted_at,
    }));

    res.json({
      entries,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("ATL entries error:", err);
    res.status(500).json({ message: "Failed to fetch ATL entries" });
  }
});

// GET /api/atl/sth — latest signed tree head
app.get("/api/atl/sth", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT tree_size, root_hash, timestamp, signature, created_at
       FROM tree_heads ORDER BY id DESC LIMIT 1`
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: "No STH available" });
      return;
    }
    const row = result.rows[0];
    res.json({
      tree_size: parseInt(row.tree_size),
      root_hash: row.root_hash instanceof Buffer ? row.root_hash.toString("hex") : row.root_hash,
      timestamp: parseInt(row.timestamp),
      signature: row.signature instanceof Buffer ? row.signature.toString("hex") : row.signature,
      created_at: row.created_at,
    });
  } catch (err) {
    console.error("ATL STH error:", err);
    res.status(500).json({ message: "Failed to fetch STH" });
  }
});

// GET /api/atl/sth/history — recent STH history for consistency display
app.get("/api/atl/sth/history", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT tree_size, root_hash, timestamp, created_at
       FROM tree_heads ORDER BY id DESC LIMIT 20`
    );
    const history = result.rows.map((row) => ({
      tree_size: parseInt(row.tree_size),
      root_hash: row.root_hash instanceof Buffer ? row.root_hash.toString("hex") : row.root_hash,
      timestamp: parseInt(row.timestamp),
      created_at: row.created_at,
    }));
    res.json({ history });
  } catch (err) {
    console.error("ATL STH history error:", err);
    res.status(500).json({ message: "Failed to fetch STH history" });
  }
});

// GET /api/atl/entry/:index — single entry detail
app.get("/api/atl/entry/:index", async (req, res) => {
  try {
    const index = parseInt(req.params.index);
    if (isNaN(index) || index < 0) {
      res.status(400).json({ message: "Invalid index" });
      return;
    }
    // leaf_index is 1-based in DB, index is 0-based
    const result = await pool.query(
      `SELECT leaf_index, entry_type, leaf_hash, job_id, tee_platform, submitter_id, submitted_at
       FROM atl_entries WHERE leaf_index = $1`,
      [index + 1]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: `Entry ${index} not found` });
      return;
    }
    const row = result.rows[0];
    res.json({
      leaf_index: parseInt(row.leaf_index) - 1,
      entry_type: row.entry_type,
      entry_type_label: row.entry_type === 1 ? "HA" : row.entry_type === 2 ? "LA" : "Config",
      leaf_hash: row.leaf_hash instanceof Buffer ? row.leaf_hash.toString("hex") : row.leaf_hash,
      job_id: row.job_id || null,
      tee_platform: row.tee_platform || null,
      submitter_id: row.submitter_id,
      submitted_at: row.submitted_at,
    });
  } catch (err) {
    console.error("ATL entry error:", err);
    res.status(500).json({ message: "Failed to fetch entry" });
  }
});

// GET /api/atl/stats — ATL-specific stats
app.get("/api/atl/stats", async (_req, res) => {
  try {
    const [countResult, typeResult, sthResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM atl_entries`),
      pool.query(
        `SELECT entry_type, COUNT(*) as count FROM atl_entries GROUP BY entry_type ORDER BY entry_type`
      ),
      pool.query(`SELECT tree_size, timestamp, created_at FROM tree_heads ORDER BY id DESC LIMIT 1`),
    ]);

    const typeCounts: Record<string, number> = {};
    for (const row of typeResult.rows) {
      const label = row.entry_type === 1 ? "ha" : row.entry_type === 2 ? "la" : "config";
      typeCounts[label] = parseInt(row.count);
    }

    const sth = sthResult.rows[0];

    res.json({
      total_entries: parseInt(countResult.rows[0].count) || 0,
      by_type: typeCounts,
      latest_sth: sth ? {
        tree_size: parseInt(sth.tree_size),
        timestamp: parseInt(sth.timestamp),
        created_at: sth.created_at,
      } : null,
    });
  } catch (err) {
    console.error("ATL stats error:", err);
    res.status(500).json({ message: "Failed to fetch ATL stats" });
  }
});

// DEV_MODE: serve local attestation root CA for client-side verification
const DEV_MODE = process.env.DEV_MODE === "true";
const LOCAL_ROOT_CERT_PEM = process.env.LOCAL_ROOT_CERT_PEM || "";

app.get("/api/dev/config", (_req, res) => {
  res.json({
    devMode: DEV_MODE,
    ...(DEV_MODE && LOCAL_ROOT_CERT_PEM ? { rootCertPem: LOCAL_ROOT_CERT_PEM } : {}),
  });
});

// Serve static frontend in production (dist/public/ from vite build)
const clientDist = path.resolve(__dirname, "public");
app.use(express.static(clientDist));
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

const port = parseInt(process.env.PORT || "3001", 10);
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Trust Hub running on port ${port}`);
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
