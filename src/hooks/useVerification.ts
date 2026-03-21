import { useEffect, useState, useCallback } from "react";
import {
  verifyAttestation,
  type VerificationResult,
  type VerificationStep,
} from "@epsilon-data/nitro-verify";
import type { JobVerification } from "@/lib/api";

const INITIAL_RESULT: VerificationResult = {
  status: "idle",
  valid: null,
  steps: [],
  attestation: null,
  certChainInfo: null,
};

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

      // Check if running in dev mode with a local root CA
      const devConfig = await getDevConfig();

      const verifyResult = await verifyAttestation(attestationDoc!, {
        expectedPcrs: job?.enclave_pcrs?.expected ?? undefined,
        expectedOutputHash: job?.execution_output_hash ?? undefined,
        allowExpired: true,
        customRootCertPem: devConfig.devMode ? devConfig.rootCertPem : undefined,
        onStepUpdate,
      });

      if (!cancelled) {
        setResult(verifyResult);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [
    job?.attestation?.attestation?.attestation_document,
    job?.enclave_pcrs?.expected,
    job?.execution_output_hash,
    onStepUpdate,
  ]);

  return { result };
}
