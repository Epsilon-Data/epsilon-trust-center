import crypto from "crypto";

// Output files of a released job: metadata only (name, size, type, sha256) — file contents are never
// read here. files_manifest_sha256 is the SHA-256 of the canonical manifest the enclave attests in
// user_data; legacy jobs have no manifest (NULL) and no file rows. A name is the file's path relative to
// outputs/ ("/" separated, e.g. plots/fig1.png) and the type is application/octet-stream unless the
// extension is in the fixed table — both come from the stored rows and are shown as-is.

export interface OutputFileEntry {
  name: string;
  size: number;
  sha256: string;
  type: string;
}

export interface OutputFilesSummary {
  count: number;
  files: OutputFileEntry[];
  // Stored on the held output (job_outputs.files_manifest_sha256); null for legacy jobs
  files_manifest_sha256: string | null;
  // Rebuilt from the file rows; must equal the stored value
  computed_manifest_sha256: string | null;
  // Value in the attestation proof (user_data); null for attestations from before output files
  attested_manifest_sha256: string | null;
  // Stored and rebuilt manifest hash equal attested one; null when either side is absent
  manifest_verified: boolean | null;
}

interface Queryable {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
}

// Canonical bytes: Python json.dumps(manifest, sort_keys=True, separators=(",", ":")) with
// ensure_ascii — keys in sorted order (name, sha256, size, type), entries sorted by name in plain
// code-point order (Python sorted on str; never localeCompare)
export function canonicalManifestJson(files: OutputFileEntry[]): string {
  const sorted = [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const json = JSON.stringify(
    sorted.map((f) => ({ name: f.name, sha256: f.sha256, size: f.size, type: f.type }))
  );
  return json.replace(/[\u0080-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

export function manifestSha256(files: OutputFileEntry[]): string {
  return crypto.createHash("sha256").update(canonicalManifestJson(files), "utf8").digest("hex");
}

export function attestedManifestSha256(attestation: unknown): string | null {
  const proof = (attestation as { proof?: Record<string, unknown> } | null)?.proof;
  const value = proof?.files_manifest_sha256;
  return typeof value === "string" && value ? value.toLowerCase() : null;
}

export function summarizeOutputFiles(
  storedManifestSha256: string | null,
  files: OutputFileEntry[],
  attestation: unknown
): OutputFilesSummary {
  const attested = attestedManifestSha256(attestation);
  // Legacy rows (no manifest, no files) have nothing to rebuild
  const computed = storedManifestSha256 === null && files.length === 0 ? null : manifestSha256(files);
  const sorted = [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return {
    count: files.length,
    files: sorted,
    files_manifest_sha256: storedManifestSha256,
    computed_manifest_sha256: computed,
    attested_manifest_sha256: attested,
    manifest_verified:
      storedManifestSha256 !== null && attested !== null
        ? storedManifestSha256 === attested && computed === attested
        : null,
  };
}

// Callers must only pass released jobs
export async function loadOutputFiles(db: Queryable, jobId: string, attestation: unknown): Promise<OutputFilesSummary> {
  const [manifestResult, filesResult] = await Promise.all([
    db.query(`SELECT files_manifest_sha256 FROM job_outputs WHERE job_id = $1`, [jobId]),
    db.query(
      `SELECT name, size, content_type, sha256 FROM job_output_files WHERE job_id = $1 ORDER BY name`,
      [jobId]
    ),
  ]);
  const stored = (manifestResult.rows[0]?.files_manifest_sha256 as string | null | undefined) ?? null;
  const files = filesResult.rows.map((row) => ({
    name: row.name as string,
    size: Number(row.size),
    sha256: row.sha256 as string,
    type: row.content_type as string,
  }));
  return summarizeOutputFiles(stored, files, attestation);
}
