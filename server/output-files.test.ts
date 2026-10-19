import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import pg from "pg";
import {
  canonicalManifestJson,
  loadOutputFiles,
  manifestSha256,
  summarizeOutputFiles,
  type OutputFileEntry,
} from "./output-files.js";

const sha256 = (data: string) => crypto.createHash("sha256").update(data).digest("hex");

// Known-answer vector shared with epsilon-attestation-verifier (computed with shasum over the
// canonical JSON): results.csv = "a,b\n1,2\n", notes.txt = "hello\n"
const KAT_FILES: OutputFileEntry[] = [
  { name: "results.csv", size: 8, sha256: sha256("a,b\n1,2\n"), type: "text/csv" },
  { name: "notes.txt", size: 6, sha256: sha256("hello\n"), type: "text/plain" },
];
const KAT_CANONICAL =
  '[{"name":"notes.txt","sha256":"5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03",' +
  '"size":6,"type":"text/plain"},' +
  '{"name":"results.csv","sha256":"492d5ea496056f1a6a6592241032fab764c321596317930b4fa0e1e8bc3b7470",' +
  '"size":8,"type":"text/csv"}]';
const KAT_SHA256 = "a1a158edd1957e859b8f27392f9591fa79a202cc90c05e161dbfb06ced480934";
const EMPTY_SHA256 = "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945";

const attestationWith = (filesManifestSha256?: string) => ({
  attestation: { attestation_document: "..." },
  proof: { job_id: "job-1", output_hash: "ab", ...(filesManifestSha256 ? { files_manifest_sha256: filesManifestSha256 } : {}) },
});

describe("manifest hash", () => {
  it("matches the known-answer vector", () => {
    assert.equal(canonicalManifestJson(KAT_FILES), KAT_CANONICAL);
    assert.equal(manifestSha256(KAT_FILES), KAT_SHA256);
  });

  it("hashes [] when there are no files", () => {
    assert.equal(canonicalManifestJson([]), "[]");
    assert.equal(manifestSha256([]), EMPTY_SHA256);
  });
});

describe("summarizeOutputFiles", () => {
  it("legacy job: no manifest, no files", () => {
    const summary = summarizeOutputFiles(null, [], attestationWith());
    assert.deepEqual(summary, {
      count: 0,
      files: [],
      files_manifest_sha256: null,
      computed_manifest_sha256: null,
      attested_manifest_sha256: null,
      manifest_verified: null,
    });
  });

  it("verifies a manifest that matches the attestation", () => {
    const summary = summarizeOutputFiles(KAT_SHA256, KAT_FILES, attestationWith(KAT_SHA256));
    assert.equal(summary.count, 2);
    assert.deepEqual(summary.files.map((f) => f.name), ["notes.txt", "results.csv"]);
    assert.equal(summary.computed_manifest_sha256, KAT_SHA256);
    assert.equal(summary.manifest_verified, true);
  });

  it("verifies an empty manifest", () => {
    const summary = summarizeOutputFiles(EMPTY_SHA256, [], attestationWith(EMPTY_SHA256));
    assert.equal(summary.count, 0);
    assert.equal(summary.manifest_verified, true);
  });

  it("fails when the stored hash differs from the attestation", () => {
    const summary = summarizeOutputFiles(EMPTY_SHA256, [], attestationWith(KAT_SHA256));
    assert.equal(summary.manifest_verified, false);
  });

  it("fails when the file rows do not rebuild the stored hash", () => {
    const tampered = [{ ...KAT_FILES[0], size: 9 }, KAT_FILES[1]];
    const summary = summarizeOutputFiles(KAT_SHA256, tampered, attestationWith(KAT_SHA256));
    assert.notEqual(summary.computed_manifest_sha256, KAT_SHA256);
    assert.equal(summary.manifest_verified, false);
  });

  it("cannot verify when the attestation has no manifest hash", () => {
    const summary = summarizeOutputFiles(KAT_SHA256, KAT_FILES, attestationWith());
    assert.equal(summary.attested_manifest_sha256, null);
    assert.equal(summary.manifest_verified, null);
  });
});

// Needs a scratch Postgres, e.g. TEST_DATABASE_URL=postgresql://postgres@localhost:55432/trust_center_test
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe("loadOutputFiles", { skip: !TEST_DATABASE_URL && "TEST_DATABASE_URL not set" }, () => {
  const schema = `tc_output_files_${process.pid}`;
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });

  before(async () => {
    await client.connect();
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await client.query(`
      CREATE TABLE job_outputs (
        job_id varchar(255) PRIMARY KEY,
        files_manifest_sha256 varchar(64)
          CHECK (files_manifest_sha256 IS NULL OR files_manifest_sha256 ~ '^[0-9a-f]{64}$')
      );
      CREATE TABLE job_output_files (
        job_id       varchar(255) NOT NULL REFERENCES job_outputs (job_id) ON DELETE CASCADE,
        name         varchar(100) NOT NULL CHECK (name ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$'),
        size         integer      NOT NULL CHECK (size >= 0),
        content_type varchar(64)  NOT NULL,
        sha256       varchar(64)  NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
        storage_key  text         NOT NULL,
        created_at   timestamptz  NOT NULL DEFAULT now(),
        PRIMARY KEY (job_id, name)
      );
    `);
    await client.query(
      `INSERT INTO job_outputs (job_id, files_manifest_sha256) VALUES ('with-files', $1), ('legacy', NULL)`,
      [KAT_SHA256]
    );
    for (const f of KAT_FILES) {
      await client.query(
        `INSERT INTO job_output_files (job_id, name, size, content_type, sha256, storage_key)
         VALUES ('with-files', $1, $2, $3, $4, $5)`,
        [f.name, f.size, f.type, f.sha256, `jobs/with-files/${f.sha256}`]
      );
    }
  });

  after(async () => {
    await client.query(`DROP SCHEMA ${schema} CASCADE`);
    await client.end();
  });

  it("reads file metadata and the manifest hash", async () => {
    const summary = await loadOutputFiles(client, "with-files", attestationWith(KAT_SHA256));
    assert.equal(summary.count, 2);
    assert.deepEqual(summary.files, [...KAT_FILES].sort((a, b) => a.name.localeCompare(b.name)));
    assert.equal(summary.files_manifest_sha256, KAT_SHA256);
    assert.equal(summary.manifest_verified, true);
  });

  it("legacy job with a NULL manifest has no output files", async () => {
    const summary = await loadOutputFiles(client, "legacy", attestationWith());
    assert.equal(summary.count, 0);
    assert.equal(summary.files_manifest_sha256, null);
    assert.equal(summary.manifest_verified, null);
  });

  it("job without a job_outputs row has no output files", async () => {
    const summary = await loadOutputFiles(client, "pre-gate", attestationWith());
    assert.equal(summary.count, 0);
    assert.equal(summary.files_manifest_sha256, null);
  });
});
