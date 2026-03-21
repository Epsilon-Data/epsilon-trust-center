import { useMemo, useCallback } from "react";
import Tree from "react-d3-tree";
import type { RawNodeDatum, CustomNodeElementProps } from "react-d3-tree";
import { truncateHash } from "@/lib/utils";
import type { ATLEntry } from "@/lib/api";

interface MerkleTreeGraphProps {
  entries: ATLEntry[];
  rootHash: string;
}

const entryTypeColors: Record<number, { bg: string; border: string; text: string; label: string }> = {
  1: { bg: "#dcfce7", border: "#16a34a", text: "#15803d", label: "HA" },
  2: { bg: "#fef3c7", border: "#d97706", text: "#b45309", label: "LA" },
  3: { bg: "#dbeafe", border: "#2563eb", text: "#1d4ed8", label: "Config" },
};

interface NodeAttr {
  hash: string;
  isLeaf: string;
  isRoot: string;
  entryType?: string;
  leafIndex?: string;
  typeLabel?: string;
}

// Build a react-d3-tree data structure from ATL entries (bottom-up Merkle tree)
function buildTreeData(entries: ATLEntry[]): RawNodeDatum {
  if (entries.length === 0) {
    return { name: "Empty", attributes: { hash: "", isLeaf: "true", isRoot: "true" } };
  }

  const sorted = [...entries].sort((a, b) => a.leaf_index - b.leaf_index);

  // Create leaf nodes
  type TNode = RawNodeDatum & { attributes: NodeAttr };
  let currentLevel: TNode[] = sorted.map((e) => ({
    name: `#${e.leaf_index} ${e.entry_type_label}`,
    attributes: {
      hash: e.leaf_hash,
      isLeaf: "true",
      isRoot: "false",
      entryType: String(e.entry_type),
      leafIndex: String(e.leaf_index),
      typeLabel: e.entry_type_label,
    },
    children: [],
  }));

  // Build interior nodes bottom-up
  while (currentLevel.length > 1) {
    const nextLevel: TNode[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1];
        const lHash = (left.attributes as NodeAttr).hash;
        const rHash = (right.attributes as NodeAttr).hash;
        nextLevel.push({
          name: "Interior",
          attributes: {
            hash: `H(${truncateHash(lHash, 4)}..${truncateHash(rHash, 4)})`,
            isLeaf: "false",
            isRoot: "false",
          },
          children: [left, right],
        });
      } else {
        // Odd node promoted
        nextLevel.push({
          name: "Interior",
          attributes: {
            hash: (currentLevel[i].attributes as NodeAttr).hash,
            isLeaf: "false",
            isRoot: "false",
          },
          children: [currentLevel[i]],
        });
      }
    }
    currentLevel = nextLevel;
  }

  // Mark root
  const root = currentLevel[0];
  (root.attributes as NodeAttr).isRoot = "true";
  root.name = "Root";
  return root;
}

const NODE_W = 148;
const NODE_H = 52;

function CustomNode({ nodeDatum }: CustomNodeElementProps) {
  const attr = nodeDatum.attributes as unknown as NodeAttr;
  const isLeaf = attr?.isLeaf === "true";
  const isRoot = attr?.isRoot === "true";
  const entryType = attr?.entryType ? parseInt(attr.entryType) : 0;

  const colors = isLeaf && entryType
    ? entryTypeColors[entryType] || { bg: "#f9fafb", border: "#d1d5db", text: "#374151", label: "" }
    : isRoot
    ? { bg: "#eff6ff", border: "#2563eb", text: "#1e40af", label: "" }
    : { bg: "#f9fafb", border: "#d1d5db", text: "#6b7280", label: "" };

  return (
    <g>
      <foreignObject
        width={NODE_W}
        height={NODE_H}
        x={-NODE_W / 2}
        y={-NODE_H / 2}
      >
        <div
          style={{
            width: NODE_W,
            height: NODE_H,
            background: colors.bg,
            border: `2px solid ${colors.border}`,
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "3px 6px",
            boxShadow: isRoot
              ? "0 3px 12px rgba(37,99,235,0.18)"
              : "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          {isRoot && (
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: colors.text,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Merkle Root
            </div>
          )}
          {isLeaf && attr?.typeLabel && (
            <div style={{ fontSize: 10, fontWeight: 600, color: colors.text }}>
              #{attr.leafIndex} {attr.typeLabel}
            </div>
          )}
          {!isLeaf && !isRoot && (
            <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 500 }}>
              Interior
            </div>
          )}
          <div
            style={{
              fontSize: 10,
              fontFamily: "ui-monospace, monospace",
              color: "#6b7280",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: NODE_W - 16,
            }}
          >
            {isLeaf ? truncateHash(attr?.hash || "", 8) : attr?.hash || ""}
          </div>
        </div>
      </foreignObject>
    </g>
  );
}

export function MerkleTreeGraph({ entries }: MerkleTreeGraphProps) {
  const treeData = useMemo(() => buildTreeData(entries), [entries]);

  const renderNode = useCallback(
    (props: CustomNodeElementProps) => <CustomNode {...props} />,
    []
  );

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No entries to visualize
      </div>
    );
  }

  return (
    <Tree
      data={treeData}
      orientation="vertical"
      pathFunc="straight"
      renderCustomNodeElement={renderNode}
      separation={{ siblings: 1.2, nonSiblings: 1.5 }}
      depthFactor={100}
      zoom={0.75}
      scaleExtent={{ min: 0.2, max: 2 }}
      nodeSize={{ x: NODE_W + 20, y: NODE_H + 40 }}
      translate={{ x: 400, y: 40 }}
      pathClassFunc={() => "merkle-edge"}
      rootNodeClassName="merkle-root"
      branchNodeClassName="merkle-branch"
      leafNodeClassName="merkle-leaf"
    />
  );
}
