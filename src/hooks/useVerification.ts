import { useEffect, useState, useCallback } from "react";
import {
  verifyAttestation,
  type VerificationResult,
  type VerificationStep,
} from "@epsilon-data/nitro-verify";
import type { JobVerification, PCRStatus } from "@/lib/api";
import { checkOutputFiles } from "@/lib/output-files";
import { checkRunRecord } from "@/lib/run-record";

const INITIAL_RESULT: VerificationResult = {
  status: "idle",
  valid: null,
  steps: [],
  attestation: null,
  certChainInfo: null,
};

// nitro-verify passes the PCR step when it has no expected values to compare.
// Only a match against a published registry version counts as passed here.
function pcrStepOverride(status: PCRStatus | undefined): Partial<VerificationStep> | null {
  if (status === "matched") return null;
  if (status === "unregistered") {
    return { status: "failed", message: "Image not registered: PCR0 matches no published enclave version" };
  }
  return { status: "skipped", message: "Not assessed: no published PCR values to compare against" };
}

function applyPcrOverride(
  stepId: string,
  update: Partial<VerificationStep>,
  override: Partial<VerificationStep> | null
): Partial<VerificationStep> {
  return override && stepId === "pcr-match" && update.status === "passed"
    ? { ...update, ...override }
    : update;
}

// Cache dev config so we don't fetch it on every verification
let devConfigCache: { devMode: boolean; rootCertPem?: string } | null = null;

async function getDevConfig() {
  if (devConfigCache) return devConfigCache;
  try {
    const res = await fetch("/api/dev/config");
    devConfigCache = await res.json();
  } catch {
    devConfigCache = { devMode: false };
  }
  return devConfigCache!;
}

export function useVerification(job: JobVerification | undefined) {
  const [result, setResult] = useState<VerificationResult>(INITIAL_RESULT);

  const onStepUpdate = useCallback(
    (stepId: string, update: Partial<VerificationStep>) => {
      setResult((prev) => ({
        ...prev,
        status: "running",
        steps: prev.steps.map((s) =>
          s.id === stepId ? { ...s, ...update } : s
        ),
      }));
    },
    []
  );

  useEffect(() => {
    const attestationDoc =
      job?.attestation?.attestation?.attestation_document;
    if (!attestationDoc) {
      return;
    }

    const pcrStatus = job?.enclave_pcrs?.status;
    let cancelled = false;

    async function run() {
      setResult({
        ...INITIAL_RESULT,
        status: "running",
        steps: [
          { id: "parse", label: "Parse Attestation Document", status: "pending" },
          { id: "cert-chain", label: "Verify Certificate Chain", status: "pending" },
          { id: "signature", label: "Verify COSE Signature", status: "pending" },
          { id: "pcr-match", label: "Compare PCR Values", status: "pending" },
          { id: "output-hash", label: "Verify Output Hash", status: "pending" },
        ],
      });

      const override = pcrStepOverride(pcrStatus);

      // Check if running in dev mode with a local root CA
      const devConfig = await getDevConfig();

      const verifyResult = await verifyAttestation(attestationDoc!, {
        expectedPcrs: job?.enclave_pcrs?.expected ?? undefined,
        expectedOutputHash: job?.execution_output_hash ?? undefined,
        allowExpired: true,
        customRootCertPem: devConfig.devMode ? devConfig.rootCertPem : undefined,
        onStepUpdate: (stepId, update) =>
          onStepUpdate(stepId, applyPcrOverride(stepId, update, override)),
      });

      // A released files manifest that differs from the attested one fails the verification
      if (verifyResult.valid && checkOutputFiles(job?.output_files, verifyResult).status === "mismatch") {
        verifyResult.valid = false;
        verifyResult.error = "Output files manifest does not match the attestation";
      }

      // A signed record of another job, attempt, outcome or error text fails the verification
      const runFailure = job ? checkRunRecord(job, verifyResult).failure : null;
      if (verifyResult.valid && runFailure) {
        verifyResult.valid = false;
        verifyResult.error = runFailure;
      }

      if (!cancelled) {
        const steps = verifyResult.steps.map((s) => ({ ...s, ...applyPcrOverride(s.id, s, override) }));
        const overridden = verifyResult.valid === true && override !== null;
        setResult({
          ...verifyResult,
          steps,
          // false = image not registered, null = image not assessed
          valid: overridden ? (override.status === "failed" ? false : null) : verifyResult.valid,
          error: overridden && override.status === "failed" ? override.message : verifyResult.error,
        });
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [job, onStepUpdate]);

  return { result };
}
