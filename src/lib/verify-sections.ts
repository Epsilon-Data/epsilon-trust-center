import {
  Shield,
  Cpu,
  Link2,
  FileCheck,
  Hash,
  FileCode,
} from "lucide-react";
import type { VerificationResult } from "@aspect-data/nitro-verify";
import type { SectionStatus } from "@/components/shared/StatusIcon";
import type { SidebarSection } from "@/lib/types";

// Map sidebar sections to verification step IDs
export const sectionStepMap: Record<SidebarSection, string> = {
  hardware: "signature",
  "enclave-image": "pcr-match",
  "certificate-chain": "cert-chain",
  "execution-proof": "parse",
  "output-integrity": "output-hash",
  "raw-document": "parse",
};

export function getStepStatus(
  sectionId: SidebarSection,
  result: VerificationResult
): SectionStatus {
  if (result.status === "idle") return "na";

  const stepId = sectionStepMap[sectionId];
  const step = result.steps.find((s) => s.id === stepId);

  if (!step) return "na";
  if (step.status === "running" || step.status === "pending") return "checking";
  if (step.status === "passed") return "verified";
  if (step.status === "failed") return "failed";
  return "na";
}

export interface SectionItem {
  id: SidebarSection;
  label: string;
  icon: React.ElementType;
  description: string;
}

export const sections: SectionItem[] = [
  {
    id: "hardware",
    label: "Hardware Attestation",
    icon: Shield,
    description: "AWS Nitro hardware signature",
  },
  {
    id: "enclave-image",
    label: "Enclave Image",
    icon: Cpu,
    description: "PCR0 / PCR1 / PCR2 values",
  },
  {
    id: "certificate-chain",
    label: "Certificate Chain",
    icon: Link2,
    description: "AWS root to enclave cert",
  },
  {
    id: "execution-proof",
    label: "Execution Proof",
    icon: FileCheck,
    description: "Job ID, timestamp, nonce",
  },
  {
    id: "output-integrity",
    label: "Output Integrity",
    icon: Hash,
    description: "SHA-256 output hash match",
  },
  {
    id: "raw-document",
    label: "Raw Attestation",
    icon: FileCode,
    description: "CBOR / COSE_Sign1 document",
  },
];
