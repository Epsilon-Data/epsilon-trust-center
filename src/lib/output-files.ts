import type { VerificationResult } from "@epsilon-data/nitro-verify";
import type { OutputFiles } from "@/lib/api";

export type OutputFilesStatus = "none" | "match" | "mismatch" | "not-attested";

export interface OutputFilesCheck {
  status: OutputFilesStatus;
  stored: string | null;
  attested: string | null;
}

// Compare the stored manifest hash with the one in the attestation user_data. The hardware-signed
// user_data parsed in the browser wins over the server's copy of the proof
export function checkOutputFiles(
  outputFiles: OutputFiles | null | undefined,
  result: VerificationResult
): OutputFilesCheck {
  const stored = outputFiles?.files_manifest_sha256 ?? null;
  const signed = result.attestation?.userData?.files_manifest_sha256;
  const attested = typeof signed === "string" && signed
    ? signed.toLowerCase()
    : outputFiles?.attested_manifest_sha256 ?? null;

  // Legacy jobs: no manifest and no files
  if (!outputFiles || (stored === null && outputFiles.count === 0)) {
    return { status: "none", stored, attested };
  }
  if (stored === null || attested === null) {
    return { status: "not-attested", stored, attested };
  }
  const match =
    stored === attested &&
    outputFiles.computed_manifest_sha256 === stored &&
    outputFiles.manifest_verified !== false;
  return { status: match ? "match" : "mismatch", stored, attested };
}

export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
