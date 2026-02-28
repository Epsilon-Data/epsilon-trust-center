import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { VerificationResult } from "@aspect-data/nitro-verify";
import type { SidebarSection } from "@/lib/types";
import { TrustNode } from "./flow/TrustNode";

interface TrustFlowGraphProps {
  selectedSection: SidebarSection;
  onSelectSection: (section: SidebarSection) => void;
  verificationResult: VerificationResult;
}

const nodeTypes: NodeTypes = {
  trust: TrustNode,
};

const sectionMapping: Record<string, SidebarSection> = {
  "aws-root": "certificate-chain",
  intermediate: "certificate-chain",
  "enclave-cert": "certificate-chain",
  signature: "hardware",
  attestation: "hardware",
  pcr0: "enclave-image",
  pcr1: "enclave-image",
  pcr2: "enclave-image",
  "user-data": "execution-proof",
  "output-hash": "output-integrity",
  "job-meta": "execution-proof",
};

// Map flow graph node IDs to verification step IDs
function getNodeVerified(
  nodeId: string,
  result: VerificationResult
): boolean | null {
  if (result.status === "idle") return null;

  const stepMap: Record<string, string> = {
    "aws-root": "cert-chain",
    intermediate: "cert-chain",
    "enclave-cert": "cert-chain",
    signature: "signature",
    attestation: "parse",
    pcr0: "pcr-match",
    pcr1: "pcr-match",
    pcr2: "pcr-match",
    "user-data": "parse",
    "output-hash": "output-hash",
    "job-meta": "parse",
  };

  const stepId = stepMap[nodeId];
  if (!stepId) return null;

  const step = result.steps.find((s) => s.id === stepId);
  if (!step) return null;
  if (step.status === "passed") return true;
  if (step.status === "failed") return false;
  return null; // pending/running/skipped
}

export function TrustFlowGraph({ selectedSection, onSelectSection, verificationResult }: TrustFlowGraphProps) {
  const nodes: Node[] = useMemo(
    () => [
      {
        id: "aws-root",
        type: "trust",
        position: { x: 180, y: 0 },
        data: {
          label: "AWS Root Certificate",
          subtitle: "Trust Anchor",
          color: "blue",
          verified: getNodeVerified("aws-root", verificationResult),
          selected: sectionMapping["aws-root"] === selectedSection,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      },
      {
        id: "intermediate",
        type: "trust",
        position: { x: 180, y: 90 },
        data: {
          label: "Intermediate Certs",
          subtitle: "CA Bundle",
          color: "blue",
          verified: getNodeVerified("intermediate", verificationResult),
          selected: sectionMapping["intermediate"] === selectedSection,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      },
      {
        id: "enclave-cert",
        type: "trust",
        position: { x: 180, y: 180 },
        data: {
          label: "Enclave Certificate",
          subtitle: "End Entity",
          color: "blue",
          verified: getNodeVerified("enclave-cert", verificationResult),
          selected: sectionMapping["enclave-cert"] === selectedSection,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      },
      {
        id: "signature",
        type: "trust",
        position: { x: 30, y: 290 },
        data: {
          label: "COSE_Sign1",
          subtitle: "ES384 Signature",
          color: "purple",
          verified: getNodeVerified("signature", verificationResult),
          selected: sectionMapping["signature"] === selectedSection,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      },
      {
        id: "attestation",
        type: "trust",
        position: { x: 180, y: 380 },
        data: {
          label: "Attestation Document",
          subtitle: "CBOR Payload",
          color: "green",
          verified: getNodeVerified("attestation", verificationResult),
          selected: sectionMapping["attestation"] === selectedSection,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      },
      {
        id: "pcr0",
        type: "trust",
        position: { x: 0, y: 480 },
        data: {
          label: "PCR0",
          subtitle: "Enclave Image",
          color: "orange",
          verified: getNodeVerified("pcr0", verificationResult),
          selected: sectionMapping["pcr0"] === selectedSection,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      },
      {
        id: "pcr1",
        type: "trust",
        position: { x: 150, y: 480 },
        data: {
          label: "PCR1",
          subtitle: "Kernel",
          color: "orange",
          verified: getNodeVerified("pcr1", verificationResult),
          selected: sectionMapping["pcr1"] === selectedSection,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      },
      {
        id: "pcr2",
        type: "trust",
        position: { x: 300, y: 480 },
        data: {
          label: "PCR2",
          subtitle: "Application",
          color: "orange",
          verified: getNodeVerified("pcr2", verificationResult),
          selected: sectionMapping["pcr2"] === selectedSection,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      },
      {
        id: "user-data",
        type: "trust",
        position: { x: 100, y: 580 },
        data: {
          label: "User Data",
          subtitle: "Execution Proof",
          color: "yellow",
          verified: getNodeVerified("user-data", verificationResult),
          selected: sectionMapping["user-data"] === selectedSection,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      },
      {
        id: "output-hash",
        type: "trust",
        position: { x: 50, y: 680 },
        data: {
          label: "Output Hash",
          subtitle: "SHA-256",
          color: "green",
          verified: getNodeVerified("output-hash", verificationResult),
          selected: sectionMapping["output-hash"] === selectedSection,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      },
      {
        id: "job-meta",
        type: "trust",
        position: { x: 250, y: 680 },
        data: {
          label: "Job Metadata",
          subtitle: "ID, Timestamp, Nonce",
          color: "gray",
          verified: getNodeVerified("job-meta", verificationResult),
          selected: sectionMapping["job-meta"] === selectedSection,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      },
    ],
    [selectedSection, verificationResult]
  );

  const edges: Edge[] = useMemo(
    () => [
      { id: "e1", source: "aws-root", target: "intermediate", label: "signs", markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#3b82f6" } },
      { id: "e2", source: "intermediate", target: "enclave-cert", label: "signs", markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#3b82f6" } },
      { id: "e3", source: "enclave-cert", target: "signature", label: "key for", markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#8b5cf6" } },
      { id: "e4", source: "signature", target: "attestation", label: "signs", markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#8b5cf6" } },
      { id: "e5", source: "attestation", target: "pcr0", label: "contains", markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#22c55e" } },
      { id: "e6", source: "attestation", target: "pcr1", label: "contains", markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#22c55e" } },
      { id: "e7", source: "attestation", target: "pcr2", label: "contains", markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#22c55e" } },
      { id: "e8", source: "attestation", target: "user-data", label: "contains", markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#eab308" } },
      { id: "e9", source: "user-data", target: "output-hash", label: "contains", markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#22c55e" } },
      { id: "e10", source: "user-data", target: "job-meta", label: "contains", markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#6b7280" } },
    ],
    []
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const section = sectionMapping[node.id];
      if (section) onSelectSection(section);
    },
    [onSelectSection]
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.5}
        maxZoom={1.5}
      >
        <Background gap={16} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
