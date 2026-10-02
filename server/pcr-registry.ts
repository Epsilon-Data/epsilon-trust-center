// Published enclave image measurements (epsilon-enclave published/pcr-registry.json) and how an
// attested PCR0 is judged against them.

export type PCRStatus = "matched" | "unregistered" | "not_assessed";

export interface PCRVersion {
  version: string;
  pcr0: string;
  pcr1: string;
  pcr2: string;
  release_date: string;
  docker_image: string;
  source_commit?: string;
}

export interface PCRRegistry {
  current_version?: string;
  versions: PCRVersion[];
}

// Match an attested PCR0 against every published version.
// "not_assessed" means there was nothing to compare — never report that as a pass.
export function assessPCR0(
  pcr0: string | null | undefined,
  registry: PCRRegistry
): { status: PCRStatus; entry: PCRVersion | null } {
  const published = registry.versions.filter((v) => v.pcr0);
  if (!pcr0 || published.length === 0) return { status: "not_assessed", entry: null };
  const entry = published.find((v) => v.pcr0.toLowerCase() === pcr0.toLowerCase()) ?? null;
  return { status: entry ? "matched" : "unregistered", entry };
}

// The receipt's own pcr_verified is ignored: the coordinator's verifier passes it
// when it has no expected PCRs. Only a registry match counts.
export function combineVerified(receiptValid: unknown, pcrStatus: PCRStatus): boolean | null {
  if (receiptValid === false || pcrStatus === "unregistered") return false;
  if (receiptValid === true && pcrStatus === "matched") return true;
  return null;
}
