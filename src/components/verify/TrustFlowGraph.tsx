import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { VerificationResult } from "@epsilon-data/nitro-verify";
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
  return null;
}

// Edge style: highlighted = yellow, dimmed = faded, default = gray
function getEdgeStyle(isHighlighted: boolean, isDimmed: boolean) {
  if (isHighlighted) {
    return { stroke: "#fbbf24", strokeWidth: 2 };
  }
  if (isDimmed) {
    return { stroke: "#bbb", strokeWidth: 1, opacity: 0.3 };
  }
  return { stroke: "#bbb", strokeWidth: 1 };
}

interface NodeDef {
  id: string;
  label: string;
  subtitle: string;
  kind: "cert" | "signature" | "attestation" | "pcr" | "proof" | "output";
  position: { x: number; y: number };
  fields?: string[];
}

const NODE_DEFS: NodeDef[] = [
  { id: "aws-root", label: "AWS Root Certificate", subtitle: "Trust Anchor", kind: "cert", position: { x: 180, y: 0 } },
  { id: "intermediate", label: "Intermediate Certs", subtitle: "CA Bundle", kind: "cert", position: { x: 180, y: 100 } },
  { id: "enclave-cert", label: "Enclave Certificate", subtitle: "End Entity", kind: "cert", position: { x: 180, y: 200 } },
  { id: "signature", label: "COSE_Sign1", subtitle: "ES384 Signature", kind: "signature", position: { x: 20, y: 310 }, fields: ["algorithm", "key_id"] },
  { id: "attestation", label: "Attestation Doc", subtitle: "CBOR Payload", kind: "attestation", position: { x: 180, y: 410 }, fields: ["module_id", "timestamp", "cabundle"] },
  { id: "pcr0", label: "PCR0", subtitle: "Enclave Image", kind: "pcr", position: { x: 0, y: 530 } },
  { id: "pcr1", label: "PCR1", subtitle: "Kernel", kind: "pcr", position: { x: 150, y: 530 } },
  { id: "pcr2", label: "PCR2", subtitle: "Application", kind: "pcr", position: { x: 300, y: 530 } },
  { id: "user-data", label: "User Data", subtitle: "Execution Proof", kind: "proof", position: { x: 100, y: 640 }, fields: ["job_id", "nonce", "output_hash"] },
  { id: "output-hash", label: "Output Hash", subtitle: "SHA-256", kind: "output", position: { x: 50, y: 760 } },
  { id: "job-meta", label: "Job Metadata", subtitle: "ID, Timestamp, Nonce", kind: "proof", position: { x: 250, y: 760 } },
];

const EDGE_DEFS: { id: string; source: string; target: string; label: string }[] = [
  { id: "e1", source: "aws-root", target: "intermediate", label: "signs" },
  { id: "e2", source: "intermediate", target: "enclave-cert", label: "signs" },
  { id: "e3", source: "enclave-cert", target: "signature", label: "key for" },
  { id: "e4", source: "signature", target: "attestation", label: "signs" },
  { id: "e5", source: "attestation", target: "pcr0", label: "contains" },
  { id: "e6", source: "attestation", target: "pcr1", label: "contains" },
  { id: "e7", source: "attestation", target: "pcr2", label: "contains" },
  { id: "e8", source: "attestation", target: "user-data", label: "contains" },
  { id: "e9", source: "user-data", target: "output-hash", label: "contains" },
  { id: "e10", source: "user-data", target: "job-meta", label: "contains" },
];

// Get all node IDs that belong to a section
function getNodesForSection(section: SidebarSection): Set<string> {
  const ids = new Set<string>();
  for (const [nodeId, sec] of Object.entries(sectionMapping)) {
    if (sec === section) ids.add(nodeId);
  }
  return ids;
}

export function TrustFlowGraph({
  selectedSection,
  onSelectSection,
  verificationResult,
}: TrustFlowGraphProps) {
  const selectedNodeIds = useMemo(
    () => getNodesForSection(selectedSection),
    [selectedSection]
  );

  // Get connected node IDs (nodes connected by edge to any selected node)
  const connectedNodeIds = useMemo(() => {
    const connected = new Set<string>();
    for (const edge of EDGE_DEFS) {
      if (selectedNodeIds.has(edge.source) || selectedNodeIds.has(edge.target)) {
        connected.add(edge.source);
        connected.add(edge.target);
      }
    }
    return connected;
  }, [selectedNodeIds]);

  const nodes: Node[] = useMemo(
    () =>
      NODE_DEFS.map((def) => {
        const isHighlighted = selectedNodeIds.has(def.id);
        const isDimmed =
          selectedNodeIds.size > 0 &&
          !isHighlighted &&
          !connectedNodeIds.has(def.id);

        return {
          id: def.id,
          type: "trust",
          position: def.position,
          data: {
            label: def.label,
            subtitle: def.subtitle,
            kind: def.kind,
            verified: getNodeVerified(def.id, verificationResult),
            isHighlighted,
            isDimmed,
            fields: def.fields,
          },
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
        };
      }),
    [selectedNodeIds, connectedNodeIds, verificationResult]
  );

  const edges: Edge[] = useMemo(
    () =>
      EDGE_DEFS.map((def) => {
        const isHighlighted =
          selectedNodeIds.has(def.source) || selectedNodeIds.has(def.target);
        const isDimmed = selectedNodeIds.size > 0 && !isHighlighted;

        return {
          id: def.id,
          source: def.source,
          target: def.target,
          label: def.label,
          animated: isHighlighted,
          style: getEdgeStyle(isHighlighted, isDimmed),
        };
      }),
    [selectedNodeIds]
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
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesConnectable={false}
        nodesDraggable={false}
        elementsSelectable
        panOnDrag
        zoomOnScroll
        zoomOnPinch
      >
        <Background gap={16} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
