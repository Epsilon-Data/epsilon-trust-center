const API_BASE = "/api";

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export interface JobListItem {
  job_id: string;
  has_attestation: boolean;
  completed_at: string;
  commit_sha: string;
  pcr0_match: boolean | null;
  server_verified: boolean | null;
}

export interface PaginatedJobs {
  jobs: JobListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface Stats {
  total_verified: number;
  verified_today: number;
  success_rate: number;
  total_failed: number;
}

export interface AttestationDoc {
  attestation_document: string;
  attestation_document_length: number;
  format: string;
  signed_by: string;
  user_data_included: boolean;
  user_data_hash?: string;
  nonce_included: boolean;
  how_to_verify: string[];
  aws_root_cert_url: string;
}

export interface Proof {
  job_id: string;
  output_hash: string;
  timestamp: number;
  nonce: string;
}

export interface AttestationData {
  attestation: AttestationDoc;
  proof: Proof;
  verification_guide: Record<string, string>;
}

export interface ServerVerification {
  valid: boolean;
  checks: {
    syntax_valid: boolean;
    certificate_chain_valid: boolean;
    signature_valid: boolean;
    pcr_verified: boolean;
    output_verified: boolean;
  };
  pcrs: { pcr0: string; pcr1: string; pcr2: string };
  module_id: string;
  timestamp: string;
  timing: Record<string, number>;
}

export interface PCRRegistryEntry {
  version: string;
  pcr0: string;
  pcr1: string;
  pcr2: string;
  release_date: string;
  docker_image: string;
  source_commit?: string;
  source_url?: string;
}

export interface JobVerification {
  job_id: string;
  status: string;
  created_at: string;
  completed_at: string;
  commit_sha: string;
  attestation: AttestationData | null;
  execution_output_hash: string | null;
  enclave_pcrs: {
    expected: { pcr0: string; pcr1: string; pcr2: string } | null;
    matched_version?: string | null;
    enclave_version?: string | null;
  };
  server_verification: ServerVerification | null;
  pcr_registry: PCRRegistryEntry | null;
}

export interface PCRRegistry {
  current_version: string;
  versions: PCRRegistryEntry[];
}

export function fetchPCRRegistry() {
  return fetchJSON<PCRRegistry>("/pcr-registry");
}

export function fetchJobs(page = 1, limit = 25) {
  return fetchJSON<PaginatedJobs>(`/jobs?page=${page}&limit=${limit}`);
}

export function fetchStats() {
  return fetchJSON<Stats>("/stats");
}

export function fetchJobVerification(jobId: string) {
  return fetchJSON<JobVerification>(`/verify/${encodeURIComponent(jobId)}`);
}

