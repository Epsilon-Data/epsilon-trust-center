import { Check, HelpCircle, ExternalLink, ShieldCheck, Lock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HashDisplay } from "@/components/shared/HashDisplay";
import { VerificationSection } from "./VerificationSection";
import { VerificationSubCard } from "./VerificationSubCard";
import { AWSLogo, GitHubLogo } from "./VendorLogo";
import { getStepStatus } from "@/lib/verify-sections";
import type { JobVerification } from "@/lib/api";
import type { VerificationResult } from "@epsilon-data/nitro-verify";
import type { SidebarSection } from "@/lib/types";

interface SimpleVerificationViewProps {
  job: JobVerification;
  verificationResult: VerificationResult;
  activeSection: SidebarSection;
  onSectionClick: (section: SidebarSection) => void;
}

const PCR_REGISTRY_URL =
  "https://github.com/Epsilon-Data/epsilon-enclave/tree/main/published";
const ENCLAVE_REPO_URL = "https://github.com/Epsilon-Data/epsilon-enclave";

export function SimpleVerificationView({
  job,
  verificationResult,
  activeSection,
  onSectionClick,
}: SimpleVerificationViewProps) {
  const allPassed =
    job.server_verification?.valid && verificationResult.valid;

  return (
    <div className="pt-4 pb-6">
      {/* Verified Banner — Phala style */}
      <VerifiedBanner allPassed={allPassed} />

      {/* Sections */}
      <div className="px-3 mt-4">
        <TEEHardwareSection
          job={job}
          verificationResult={verificationResult}
          active={activeSection === "hardware"}
          onSectionClick={() => onSectionClick("hardware")}
        />
        <SourceCodeSection
          job={job}
          verificationResult={verificationResult}
          active={activeSection === "enclave-image"}
          onSectionClick={() => onSectionClick("enclave-image")}
        />
        <CertificateChainSection
          job={job}
          verificationResult={verificationResult}
          active={activeSection === "certificate-chain"}
          onSectionClick={() => onSectionClick("certificate-chain")}
        />
        <ExecutionSection
          job={job}
          verificationResult={verificationResult}
          active={activeSection === "execution-proof"}
          onSectionClick={() => onSectionClick("execution-proof")}
        />
        <OutputIntegritySection
          job={job}
          verificationResult={verificationResult}
          active={activeSection === "output-integrity"}
          onSectionClick={() => onSectionClick("output-integrity")}
        />
      </div>
    </div>
  );
}

/* ─── Verified Banner ──────────────────────────────────────────── */

function VerifiedBanner({ allPassed }: { allPassed: boolean | null | undefined }) {
  if (allPassed) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/30 px-5 py-4 mb-4">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4" />
          <h2 className="font-medium">This Execution Has Been Verified</h2>
        </div>

        {/* Attested by */}
        <div className="flex items-center gap-1.5 mt-3 text-sm text-muted-foreground">
          <span>Attested by</span>
          <AWSLogo className="h-4 w-auto" />
          <span>AWS Nitro Enclaves</span>
        </div>

        {/* Description */}
        <p className="mt-2 text-xs text-muted-foreground">
          This automated verification tool lets you independently confirm that
          your analysis ran inside a genuine Trusted Execution Environment (TEE).
        </p>

        {/* Related links */}
        <div className="flex items-center gap-3 mt-3">
          <span className="text-xs text-muted-foreground">Related Links</span>
          <a
            href="/about"
            className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
          >
            How It Works
          </a>
          <a
            href="https://docs.aws.amazon.com/enclaves/latest/user/nitro-enclave.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
          >
            TEE Attestation
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-red-50 dark:bg-red-950/30 px-5 py-4 mb-4">
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
        <XCircle className="h-4 w-4" />
        <h2 className="font-medium">Verification Failed</h2>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        One or more security checks did not pass. Review the sections below for details.
      </p>
    </div>
  );
}

/* ─── 1. TEE Hardware Verified ─────────────────────────────────── */

function TEEHardwareSection({
  job,
  verificationResult,
  active,
  onSectionClick,
}: {
  job: JobVerification;
  verificationResult: VerificationResult;
  active: boolean;
  onSectionClick: () => void;
}) {
  const att = job.attestation?.attestation;
  const moduleId = verificationResult.attestation?.moduleId;

  const details = [
    moduleId && { label: "Module ID", value: moduleId, mono: true },
    att?.format && { label: "Format", value: att.format },
    att?.signed_by && { label: "Signed By", value: att.signed_by },
  ].filter(Boolean) as { label: string; value: string; mono?: boolean }[];

  return (
    <VerificationSection
      title="TEE Hardware Verified"
      status={getStepStatus("hardware", verificationResult)}
      onClick={onSectionClick}
    >
      <VerificationSubCard
        title="AWS Nitro Attestation"
        vendorLogo={<AWSLogo className="h-4 w-auto text-muted-foreground" />}
        description="AWS Nitro Enclaves provide hardware-level isolation using a dedicated hypervisor. This attestation proves your analysis ran on genuine AWS Nitro hardware — not a simulation."
        learnMoreLinks={[
          {
            label: "Learn about AWS Nitro Enclaves",
            href: "https://docs.aws.amazon.com/enclaves/latest/user/nitro-enclave.html",
          },
        ]}
        details={details}
        selected={active}
        onSelect={onSectionClick}
      />
    </VerificationSection>
  );
}

/* ─── 2. Source Code Verified ──────────────────────────────────── */

function SourceCodeSection({
  job,
  verificationResult,
  active,
  onSectionClick,
}: {
  job: JobVerification;
  verificationResult: VerificationResult;
  active: boolean;
  onSectionClick: () => void;
}) {
  const registry = job.pcr_registry;
  const matchedVersion =
    job.enclave_pcrs?.matched_version || job.enclave_pcrs?.enclave_version;

  const serverPcrs = job.server_verification?.pcrs;
  const registryPcrs = registry
    ? { pcr0: registry.pcr0, pcr1: registry.pcr1, pcr2: registry.pcr2 }
    : job.enclave_pcrs?.expected;
  const browserPcrs = verificationResult.attestation
    ? {
        pcr0: verificationResult.attestation.pcrs[0],
        pcr1: verificationResult.attestation.pcrs[1],
        pcr2: verificationResult.attestation.pcrs[2],
      }
    : undefined;

  const details = [
    matchedVersion && { label: "Enclave Version", value: matchedVersion },
    (registry?.source_commit || job.commit_sha) && {
      label: "Source Commit",
      value: registry?.source_commit || job.commit_sha,
      mono: true,
    },
    registry?.docker_image && {
      label: "Docker Image",
      value: registry.docker_image,
      mono: true,
    },
  ].filter(Boolean) as { label: string; value: string; mono?: boolean }[];

  return (
    <VerificationSection
      title="Source Code Verified"
      status={getStepStatus("enclave-image", verificationResult)}
      onClick={onSectionClick}
    >
      <VerificationSubCard
        title="Enclave Image (PCR Values)"
        vendorLogo={<GitHubLogo className="h-4 w-auto text-muted-foreground" />}
        description="Platform Configuration Registers (PCRs) are hardware-measured hashes that prove the exact code running inside the enclave matches the published open-source version."
        learnMoreLinks={[
          { label: "View source on GitHub", href: ENCLAVE_REPO_URL },
          { label: "PCR Registry", href: PCR_REGISTRY_URL },
        ]}
        details={details}
        selected={active}
        onSelect={onSectionClick}
      >
        {/* Compact 3-way PCR comparison */}
        {(serverPcrs || registryPcrs || browserPcrs) && (
          <CompactPCRComparison
            serverPcrs={serverPcrs}
            registryPcrs={registryPcrs}
            browserPcrs={browserPcrs}
          />
        )}
      </VerificationSubCard>
    </VerificationSection>
  );
}

/* ─── 3. Certificate Chain Verified ────────────────────────────── */

function CertificateChainSection({
  job,
  verificationResult,
  active,
  onSectionClick,
}: {
  job: JobVerification;
  verificationResult: VerificationResult;
  active: boolean;
  onSectionClick: () => void;
}) {
  const chainInfo = verificationResult.certChainInfo;
  const awsRootCertUrl = job.attestation?.attestation?.aws_root_cert_url;

  const details = [
    chainInfo?.depth != null && {
      label: "Chain Depth",
      value: `${chainInfo.depth} certificates`,
    },
    chainInfo?.root?.cn && { label: "Root CN", value: chainInfo.root.cn },
    chainInfo?.endEntity?.cn && {
      label: "End Entity CN",
      value: chainInfo.endEntity.cn,
    },
    chainInfo?.endEntity?.validFrom && {
      label: "Valid From",
      value: new Date(chainInfo.endEntity.validFrom).toLocaleString(),
    },
    chainInfo?.endEntity?.validTo && {
      label: "Valid To",
      value: new Date(chainInfo.endEntity.validTo).toLocaleString(),
    },
  ].filter(Boolean) as { label: string; value: string; mono?: boolean }[];

  const links = [
    awsRootCertUrl && {
      label: "AWS Root Certificate",
      href: awsRootCertUrl,
    },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <VerificationSection
      title="Certificate Chain Verified"
      status={getStepStatus("certificate-chain", verificationResult)}
      onClick={onSectionClick}
    >
      <VerificationSubCard
        title="AWS Root of Trust"
        vendorLogo={<AWSLogo className="h-4 w-auto text-muted-foreground" />}
        description="The certificate chain traces back to Amazon's root authority, confirming this attestation was signed by genuine AWS hardware and not a forged document."
        learnMoreLinks={links}
        details={details}
        selected={active}
        onSelect={onSectionClick}
      />
    </VerificationSection>
  );
}

/* ─── 4. Execution Verified ────────────────────────────────────── */

function ExecutionSection({
  job,
  verificationResult,
  active,
  onSectionClick,
}: {
  job: JobVerification;
  verificationResult: VerificationResult;
  active: boolean;
  onSectionClick: () => void;
}) {
  const proof = job.attestation?.proof;

  const details = [
    proof?.job_id && { label: "Job ID", value: proof.job_id, mono: true },
    proof?.timestamp && {
      label: "Timestamp",
      value: new Date(proof.timestamp * 1000).toLocaleString(),
    },
    proof?.nonce && { label: "Nonce", value: proof.nonce, mono: true },
    job.commit_sha && { label: "Commit SHA", value: job.commit_sha, mono: true },
  ].filter(Boolean) as { label: string; value: string; mono?: boolean }[];

  return (
    <VerificationSection
      title="Execution Verified"
      status={getStepStatus("execution-proof", verificationResult)}
      onClick={onSectionClick}
    >
      <VerificationSubCard
        title="Job Execution Proof"
        vendorLogo={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
        description="Cryptographic proof that this specific job ran inside the attested enclave. The job ID, timestamp, and nonce are embedded in the attestation, binding it to this exact execution."
        details={details}
        selected={active}
        onSelect={onSectionClick}
      />
    </VerificationSection>
  );
}

/* ─── 5. Output Integrity Verified ─────────────────────────────── */

function OutputIntegritySection({
  job,
  verificationResult,
  active,
  onSectionClick,
}: {
  job: JobVerification;
  verificationResult: VerificationResult;
  active: boolean;
  onSectionClick: () => void;
}) {
  const proofHash = job.attestation?.proof?.output_hash;
  const computedHash = job.execution_output_hash;
  const match = proofHash && computedHash && proofHash === computedHash;

  return (
    <VerificationSection
      title="Output Integrity Verified"
      status={getStepStatus("output-integrity", verificationResult)}
      onClick={onSectionClick}
    >
      <VerificationSubCard
        title="SHA-256 Output Hash"
        vendorLogo={<Lock className="h-4 w-4 text-muted-foreground" />}
        description="The SHA-256 hash of the execution output is embedded inside the attestation document. If the output was tampered with after leaving the enclave, the hashes will not match."
        learnMoreLinks={[{ label: "About Epsilon", href: "/about" }]}
        selected={active}
        onSelect={onSectionClick}
      >
        {proofHash && (
          <div className="space-y-2">
            <HashDisplay label="Attestation Hash" hash={proofHash} truncate={false} />
            {computedHash && (
              <HashDisplay label="Computed Hash" hash={computedHash} truncate={false} />
            )}
            <div className="flex items-center gap-2 pt-1">
              <Badge
                variant={match ? "success" : computedHash ? "destructive" : "secondary"}
                className="text-xs"
              >
                {match ? "Match" : computedHash ? "Mismatch" : "Pending"}
              </Badge>
            </div>
          </div>
        )}
      </VerificationSubCard>
    </VerificationSection>
  );
}

/* ─── Compact PCR Comparison ───────────────────────────────────── */

function CompactPCRComparison({
  serverPcrs,
  registryPcrs,
  browserPcrs,
}: {
  serverPcrs?: { pcr0: string; pcr1: string; pcr2: string };
  registryPcrs?: { pcr0: string; pcr1: string; pcr2: string } | null;
  browserPcrs?: { pcr0: string; pcr1: string; pcr2: string };
}) {
  const pcrKeys = ["pcr0", "pcr1", "pcr2"] as const;
  const labels = ["PCR0 (Enclave Image)", "PCR1 (Kernel)", "PCR2 (Application)"];
  const sources = [
    { key: "Attestation", pcrs: browserPcrs || serverPcrs },
    { key: "Published", pcrs: registryPcrs },
  ].filter((s) => s.pcrs) as { key: string; pcrs: Record<string, string> }[];

  return (
    <div className="space-y-2">
      {pcrKeys.map((pcr, i) => {
        const values = sources.map((s) => s.pcrs[pcr]).filter(Boolean);
        const referenceValue = values[0];
        const allMatch =
          values.length >= 2 && values.every((v) => v === referenceValue);

        return (
          <div key={pcr} className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="block font-medium text-xs text-muted-foreground">
                {labels[i]}
              </p>
              {values.length >= 2 && (
                <Badge
                  variant={allMatch ? "success" : "destructive"}
                  className="text-[10px] px-1.5 py-0"
                >
                  {allMatch ? "All match" : "Mismatch"}
                </Badge>
              )}
            </div>
            <div className="rounded bg-muted/50 border border-border">
              {sources.map((source) => {
                const val = source.pcrs[pcr];
                if (!val) return null;
                return (
                  <div
                    key={source.key}
                    className="flex items-start gap-2 px-2 py-1 border-b border-border last:border-b-0"
                  >
                    <span className="text-[10px] text-muted-foreground/70 shrink-0 w-12 pt-0.5">
                      {source.key}
                    </span>
                    <code className="text-[10px] font-mono break-all flex-1">
                      {val}
                    </code>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
